import { createClient } from 'npm:@supabase/supabase-js@2';
import type { NewsAPIResponse, NewsAPIArticle } from '../shared/monitor-types.ts';
import {
  generateUrlHash,
  normalizeTitle,
  normalizeContent,
  extractDomain,
  createSnippet,
  containsCaymanKeywords,
  parseDate,
  formatError,
} from '../shared/monitor-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const lookbackHours = body.lookback_hours || null;

    console.log('Starting NewsAPI ingestion...');

    // Load monitor settings
    const { data: settings, error: settingsError } = await supabase
      .from('monitor_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000002')
      .single();

    if (settingsError) {
      throw new Error(`Failed to load settings: ${settingsError.message}`);
    }

    if (!settings.newsapi_enabled || !settings.newsapi_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NewsAPI is disabled or API key is missing',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const requestsToday = settings.newsapi_requests_today || 0;
    const dailyLimit = settings.newsapi_daily_limit || 100;

    if (requestsToday >= dailyLimit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `NewsAPI daily limit reached (${dailyLimit} requests)`,
          requests_today: requestsToday,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hours = lookbackHours || settings.lookback_hours || 24;
    const caymanKeywords = settings.cayman_keywords || [];

    // Create ingestion run record
    const { data: run, error: runError } = await supabase
      .from('monitor_ingestion_runs')
      .insert({
        source_api: 'newsapi',
        status: 'running',
        triggered_by: body.triggered_by || 'manual',
        metadata: { lookback_hours: hours, requests_today: requestsToday },
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create ingestion run: ${runError.message}`);
    }

    console.log(`Created ingestion run: ${run.id}`);

    const errors: string[] = [];
    let articlesFetched = 0;
    let articlesNew = 0;
    let articlesDuplicate = 0;
    let articlesCaymanRelevant = 0;

    try {
      // Calculate 'from' date (lookback)
      const now = new Date();
      const fromDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const fromISO = fromDate.toISOString();

      // Build NewsAPI query
      // Use most restrictive search to maximize relevance within rate limits
      const query = encodeURIComponent('Cayman Islands finance OR Cayman hedge fund OR Cayman investment');
      const newsapiUrl = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=100&from=${fromISO}`;

      console.log(`Querying NewsAPI: ${newsapiUrl}`);

      // Fetch from NewsAPI
      const newsapiResponse = await fetch(newsapiUrl, {
        headers: {
          'X-Api-Key': settings.newsapi_key,
        },
      });

      // Increment request counter
      await supabase
        .from('monitor_settings')
        .update({
          newsapi_requests_today: requestsToday + 1,
        })
        .eq('id', '00000000-0000-0000-0000-000000000002');

      if (!newsapiResponse.ok) {
        const errorText = await newsapiResponse.text();
        throw new Error(`NewsAPI error: ${newsapiResponse.status} ${errorText}`);
      }

      const newsapiData: NewsAPIResponse = await newsapiResponse.json();

      if (newsapiData.status !== 'ok') {
        throw new Error(`NewsAPI returned status: ${newsapiData.status}`);
      }

      const articles = newsapiData.articles || [];

      console.log(`NewsAPI returned ${articles.length} articles`);
      articlesFetched = articles.length;

      // Filter for Cayman keywords (NewsAPI query is already filtered, but double-check)
      const filteredArticles = articles.filter((article: NewsAPIArticle) => {
        const titleMatches = containsCaymanKeywords(article.title, caymanKeywords);
        const descMatches = article.description
          ? containsCaymanKeywords(article.description, caymanKeywords)
          : [];
        return titleMatches.length > 0 || descMatches.length > 0;
      });

      console.log(`After filtering: ${filteredArticles.length} Cayman-related articles`);

      // Process each article
      for (const article of filteredArticles) {
        try {
          const url = article.url;
          const url_hash = await generateUrlHash(url);
          const title = article.title;
          const title_normalized = normalizeTitle(title);
          const published_at = parseDate(article.publishedAt);
          const source_domain = extractDomain(url);
          const source_name = article.source.name || source_domain;
          const author = article.author;
          const content_raw = article.content;
          const content_normalized = content_raw ? normalizeContent(content_raw) : null;
          const content_snippet = createSnippet(article.description || content_raw || title, 500);

          // Check for existing article with same URL hash
          const { data: existing } = await supabase
            .from('monitor_articles')
            .select('id')
            .eq('url_hash', url_hash)
            .maybeSingle();

          if (existing) {
            articlesDuplicate++;
            continue;
          }

          // Check for near-duplicate by title
          const { data: titleDupe } = await supabase
            .from('monitor_articles')
            .select('id, title_normalized')
            .eq('title_normalized', title_normalized)
            .maybeSingle();

          if (titleDupe) {
            articlesDuplicate++;
            continue;
          }

          // Detect matched Cayman keywords
          const matched_keywords = containsCaymanKeywords(
            `${title} ${article.description || ''} ${content_raw || ''}`,
            caymanKeywords
          );

          // Insert article
          const { error: insertError } = await supabase
            .from('monitor_articles')
            .insert({
              source_api: 'newsapi',
              source_id: url_hash.substring(0, 32),
              url,
              url_hash,
              title,
              title_normalized,
              published_at,
              content_raw,
              content_normalized,
              content_snippet,
              language: 'en',
              source_name,
              source_domain,
              author,
              cayman_keywords: matched_keywords,
              status: 'pending',
            });

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate key error
              articlesDuplicate++;
            } else {
              throw insertError;
            }
          } else {
            articlesNew++;
            if (matched_keywords.length > 0) {
              articlesCaymanRelevant++;
            }
          }
        } catch (articleError) {
          const errorMsg = formatError(articleError);
          console.error(`Error processing article: ${errorMsg}`);
          errors.push(`Article ${article.url}: ${errorMsg}`);
        }
      }

      // Update ingestion run
      await supabase
        .from('monitor_ingestion_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          articles_fetched: articlesFetched,
          articles_new: articlesNew,
          articles_duplicate: articlesDuplicate,
          articles_cayman_relevant: articlesCaymanRelevant,
          errors,
        })
        .eq('id', run.id);

      console.log(`NewsAPI ingestion completed: ${articlesNew} new articles`);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: run.id,
          articles_fetched: articlesFetched,
          articles_new: articlesNew,
          articles_duplicate: articlesDuplicate,
          articles_cayman_relevant: articlesCaymanRelevant,
          requests_today: requestsToday + 1,
          daily_limit: dailyLimit,
          errors: errors.length > 0 ? errors : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (ingestionError) {
      const errorMsg = formatError(ingestionError);
      console.error(`NewsAPI ingestion failed: ${errorMsg}`);

      // Update run as failed
      await supabase
        .from('monitor_ingestion_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          articles_fetched: articlesFetched,
          articles_new: articlesNew,
          articles_duplicate: articlesDuplicate,
          errors: [...errors, errorMsg],
        })
        .eq('id', run.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          run_id: run.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: formatError(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

