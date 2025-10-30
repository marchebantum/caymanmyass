import { createClient } from 'npm:@supabase/supabase-js@2';
import type { GDELTResponse, GDELTArticle } from '../shared/monitor-types.ts';
import {
  generateUrlHash,
  normalizeTitle,
  normalizeContent,
  extractDomain,
  createSnippet,
  containsCaymanKeywords,
  parseDate,
  sleep,
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

    console.log('Starting GDELT ingestion...');

    // Load monitor settings
    const { data: settings, error: settingsError } = await supabase
      .from('monitor_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000002')
      .single();

    if (settingsError) {
      throw new Error(`Failed to load settings: ${settingsError.message}`);
    }

    if (!settings.gdelt_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GDELT ingestion is disabled in settings',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hours = lookbackHours || settings.lookback_hours || 24;
    const maxArticles = settings.max_articles_per_run || 100;
    const caymanKeywords = settings.cayman_keywords || [];

    // Create ingestion run record
    const { data: run, error: runError } = await supabase
      .from('monitor_ingestion_runs')
      .insert({
        source_api: 'gdelt',
        status: 'running',
        triggered_by: body.triggered_by || 'manual',
        metadata: { lookback_hours: hours },
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
      // Build GDELT query
      // Query for Cayman Islands related finance articles
      const query = encodeURIComponent(
        '(Cayman Islands OR Grand Cayman OR Cayman domiciled OR Cayman-registered) AND (fund OR hedge OR finance OR investment OR liquidation OR bankruptcy)'
      );
      const timespan = `${hours}h`;
      const gdeltUrl = `http://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=${maxArticles}&format=json&timespan=${timespan}&sort=datedesc`;

      console.log(`Querying GDELT: ${gdeltUrl}`);

      // Fetch from GDELT (with 1 second courtesy delay)
      await sleep(1000);

      const gdeltResponse = await fetch(gdeltUrl);

      if (!gdeltResponse.ok) {
        throw new Error(`GDELT API error: ${gdeltResponse.status} ${gdeltResponse.statusText}`);
      }

      const gdeltData: GDELTResponse = await gdeltResponse.json();
      const articles = gdeltData.articles || [];

      console.log(`GDELT returned ${articles.length} articles`);
      articlesFetched = articles.length;

      // Filter for English language and Cayman keywords
      const filteredArticles = articles.filter((article: GDELTArticle) => {
        if (article.language !== 'en' && article.language !== 'eng') {
          return false;
        }

        // Basic keyword filter on title
        const titleMatches = containsCaymanKeywords(article.title, caymanKeywords);
        return titleMatches.length > 0;
      });

      console.log(`After filtering: ${filteredArticles.length} Cayman-related English articles`);

      // Process each article
      for (const article of filteredArticles) {
        try {
          const url = article.url;
          const url_hash = await generateUrlHash(url);
          const title = article.title;
          const title_normalized = normalizeTitle(title);
          const published_at = parseDate(article.seendate);
          const source_domain = article.domain || extractDomain(url);
          const source_name = source_domain;
          const content_snippet = createSnippet(title, 500);

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

          // Check for near-duplicate by title (simple check - just exact normalized match for now)
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
          const matched_keywords = containsCaymanKeywords(title, caymanKeywords);

          // Insert article
          const { error: insertError } = await supabase
            .from('monitor_articles')
            .insert({
              source_api: 'gdelt',
              source_id: url_hash.substring(0, 32), // Use first 32 chars of hash as ID
              url,
              url_hash,
              title,
              title_normalized,
              published_at,
              content_raw: null, // GDELT doesn't provide full content
              content_normalized: null,
              content_snippet,
              language: 'en',
              source_name,
              source_domain,
              author: null,
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

      console.log(`GDELT ingestion completed: ${articlesNew} new articles`);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: run.id,
          articles_fetched: articlesFetched,
          articles_new: articlesNew,
          articles_duplicate: articlesDuplicate,
          articles_cayman_relevant: articlesCaymanRelevant,
          errors: errors.length > 0 ? errors : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (ingestionError) {
      const errorMsg = formatError(ingestionError);
      console.error(`GDELT ingestion failed: ${errorMsg}`);

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

