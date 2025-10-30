import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// NewsAPI endpoint
const NEWSAPI_BASE_URL = 'https://newsapi.org/v2/everything';

// Default Cayman query terms
const CAYMAN_QUERY = 'Cayman Islands OR "Grand Cayman" OR "Cayman-registered" OR "Cayman-domiciled" OR CIMA';

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string; // ISO 8601
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Compute SHA256 hash of a string
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse allow sources from env
 */
function parseAllowSources(allowSourcesEnv: string | undefined): Set<string> | null {
  if (!allowSourcesEnv || allowSourcesEnv.trim() === '') {
    return null;
  }
  
  const sources = allowSourcesEnv
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
  
  return new Set(sources);
}

/**
 * Check if source is allowed
 */
function isSourceAllowed(url: string, allowedSources: Set<string> | null): boolean {
  if (!allowedSources) {
    return true; // No filter, allow all
  }
  
  const domain = extractDomain(url).toLowerCase();
  
  // Check exact match or parent domain match
  for (const allowedSource of allowedSources) {
    if (domain === allowedSource || domain.endsWith(`.${allowedSource}`)) {
      return true;
    }
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let runId: string | null = null;

  try {
    // Check for API key
    const newsapiKey = Deno.env.get('NEWSAPI_KEY');
    if (!newsapiKey) {
      throw new Error('NEWSAPI_KEY not configured in environment');
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const requestedSince = body.since;
    const customQuery = body.q;
    const pageSize = body.pageSize || 50;

    // Default since: 24 hours ago
    const since = requestedSince || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Parse allow sources filter
    const allowedSources = parseAllowSources(Deno.env.get('ALLOW_SOURCES'));
    
    console.log(`Starting NewsAPI ingestion. Since: ${since}, PageSize: ${pageSize}`);
    if (allowedSources) {
      console.log(`Source filter enabled: ${Array.from(allowedSources).join(', ')}`);
    }

    // Create ingest_runs record
    const { data: run, error: runError } = await supabase
      .from('ingest_runs')
      .insert({
        source: 'newsapi',
        status: 'started',
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create ingest_run: ${runError.message}`);
    }

    runId = run.id;

    // Build NewsAPI query
    const finalQuery = customQuery ? `(${CAYMAN_QUERY}) AND (${customQuery})` : CAYMAN_QUERY;
    
    // Build NewsAPI request
    const newsApiUrl = new URL(NEWSAPI_BASE_URL);
    newsApiUrl.searchParams.set('q', finalQuery);
    newsApiUrl.searchParams.set('from', since);
    newsApiUrl.searchParams.set('language', 'en');
    newsApiUrl.searchParams.set('sortBy', 'publishedAt');
    newsApiUrl.searchParams.set('pageSize', String(Math.min(pageSize, 100))); // Max 100 per request
    newsApiUrl.searchParams.set('apiKey', newsapiKey);

    console.log(`Querying NewsAPI: ${newsApiUrl.toString().replace(newsapiKey, 'REDACTED')}`);

    // Fetch from NewsAPI
    const newsApiResponse = await fetch(newsApiUrl.toString());

    if (!newsApiResponse.ok) {
      const errorText = await newsApiResponse.text();
      throw new Error(`NewsAPI error: ${newsApiResponse.status} ${newsApiResponse.statusText} - ${errorText}`);
    }

    const newsApiData: NewsAPIResponse = await newsApiResponse.json();

    if (newsApiData.status !== 'ok') {
      throw new Error(`NewsAPI returned error status: ${newsApiData.status}`);
    }

    const articles = newsApiData.articles || [];

    console.log(`NewsAPI returned ${articles.length} articles (total available: ${newsApiData.totalResults})`);

    let fetched = articles.length;
    let stored = 0;
    let skipped = 0;
    let filtered = 0;

    // Process each article
    for (const article of articles) {
      try {
        // Skip if no URL
        if (!article.url) {
          console.log('Skipping article: no URL');
          skipped++;
          continue;
        }

        // Apply source filter if configured
        if (!isSourceAllowed(article.url, allowedSources)) {
          console.log(`Filtered out: ${extractDomain(article.url)} (not in allowlist)`);
          filtered++;
          continue;
        }

        // Compute URL hash
        const url_hash = await sha256(article.url);

        // Extract source domain
        const source_domain = extractDomain(article.url);

        // Parse published date (already in ISO format from NewsAPI)
        const published_at = article.publishedAt;

        // Prepare article record
        const articleData = {
          url: article.url,
          url_hash,
          source: source_domain,
          title: article.title || null,
          excerpt: article.description || article.title || null,
          body: null, // Not storing full content for MVP
          published_at,
          cayman_flag: false, // Will be set by classifier
          signals: {},
          reasons: [],
          confidence: null,
          embedding: null,
          meta: {
            newsapi_source_id: article.source.id,
            newsapi_source_name: article.source.name,
            author: article.author,
            url_to_image: article.urlToImage,
            content_preview: article.content, // NewsAPI provides partial content
          },
        };

        // Upsert into articles table (by url unique constraint)
        const { error: upsertError } = await supabase
          .from('articles')
          .upsert(articleData, {
            onConflict: 'url',
            ignoreDuplicates: true,
          });

        if (upsertError) {
          // Check if it's a duplicate (should be caught by ignoreDuplicates)
          if (upsertError.code === '23505') {
            skipped++;
          } else {
            console.error(`Error upserting article ${article.url}:`, upsertError);
            skipped++;
          }
        } else {
          stored++;
        }
      } catch (articleError) {
        console.error('Error processing article:', articleError);
        skipped++;
      }
    }

    // Update ingest_runs record
    await supabase
      .from('ingest_runs')
      .update({
        status: 'completed',
        fetched,
        stored,
        skipped: skipped + filtered,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    console.log(`NewsAPI ingestion completed: ${stored} stored, ${skipped} skipped, ${filtered} filtered`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        fetched,
        stored,
        skipped,
        filtered,
        total_results: newsApiData.totalResults,
        since,
        page_size: pageSize,
        allow_sources_enabled: allowedSources !== null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('NewsAPI ingestion failed:', error);

    // Update ingest_runs on error
    if (runId) {
      await supabase
        .from('ingest_runs')
        .update({
          status: 'failed',
          error: String(error),
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        run_id: runId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
