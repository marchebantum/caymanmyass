import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Cayman seed terms for GDELT query
const CAYMAN_SEED_TERMS = [
  '"Cayman Islands"',
  '"Grand Cayman"',
  '"Cayman-registered"',
  '"Cayman-domiciled"',
  'CIMA',
  '"Segregated Portfolio Company"',
  '"Exempted Company"',
];

interface GDELTArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // Format: YYYYMMDDTHHMMSSZ
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry?: string;
}

interface GDELTResponse {
  articles?: GDELTArticle[];
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
 * Parse GDELT seendate to ISO timestamp
 * Format: 20251031T123000Z -> 2025-10-31T12:30:00Z
 */
function parseGDELTDate(seendate: string): string {
  try {
    const year = seendate.substring(0, 4);
    const month = seendate.substring(4, 6);
    const day = seendate.substring(6, 8);
    const hour = seendate.substring(9, 11);
    const minute = seendate.substring(11, 13);
    const second = seendate.substring(13, 15);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Calculate timespan parameter for GDELT
 */
function calculateTimespan(since: string): string {
  const sinceDate = new Date(since);
  const now = new Date();
  const diffMs = now.getTime() - sinceDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours <= 0) return '1h';
  if (diffHours <= 48) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 30) return `${diffDays}d`;
  
  return '30d'; // GDELT max
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
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const requestedSince = body.since;
    const customQuery = body.q;

    // Default since: 24 hours ago
    const since = requestedSince || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`Starting GDELT ingestion. Since: ${since}`);

    // Create ingest_runs record
    const { data: run, error: runError } = await supabase
      .from('ingest_runs')
      .insert({
        source: 'gdelt',
        status: 'started',
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create ingest_run: ${runError.message}`);
    }

    runId = run.id;

    // Build GDELT query
    // Base boolean: ("Cayman Islands" OR "Grand Cayman" OR ...)
    const caymanQuery = `(${CAYMAN_SEED_TERMS.join(' OR ')})`;
    const finalQuery = customQuery ? `${caymanQuery} AND (${customQuery})` : caymanQuery;
    
    // Calculate timespan
    const timespan = calculateTimespan(since);
    
    // Build GDELT API URL
    const gdeltUrl = new URL('http://api.gdeltproject.org/api/v2/doc/doc');
    gdeltUrl.searchParams.set('query', finalQuery);
    gdeltUrl.searchParams.set('mode', 'artlist');
    gdeltUrl.searchParams.set('maxrecords', '250');
    gdeltUrl.searchParams.set('format', 'json');
    gdeltUrl.searchParams.set('timespan', timespan);
    gdeltUrl.searchParams.set('sort', 'datedesc');

    console.log(`Querying GDELT: ${gdeltUrl.toString()}`);

    // Fetch from GDELT
    const gdeltResponse = await fetch(gdeltUrl.toString());

    if (!gdeltResponse.ok) {
      throw new Error(`GDELT API error: ${gdeltResponse.status} ${gdeltResponse.statusText}`);
    }

    const gdeltData: GDELTResponse = await gdeltResponse.json();
    const articles = gdeltData.articles || [];

    console.log(`GDELT returned ${articles.length} articles`);

    // Filter for English only
    const englishArticles = articles.filter(
      article => article.language === 'en' || article.language === 'eng'
    );

    console.log(`After English filter: ${englishArticles.length} articles`);

    let fetched = englishArticles.length;
    let stored = 0;
    let skipped = 0;

    // Process each article
    for (const article of englishArticles) {
      try {
        // Canonical URL (use url field, fallback to url_mobile)
        const canonical_url = article.url || article.url_mobile;
        if (!canonical_url) {
          console.log('Skipping article: no URL');
          skipped++;
          continue;
        }

        // Compute URL hash
        const url_hash = await sha256(canonical_url);

        // Extract source domain
        const source_domain = extractDomain(canonical_url);

        // Parse published date
        const published_at = parseGDELTDate(article.seendate);

        // Prepare article record
        const articleData = {
          url: canonical_url,
          url_hash,
          source: source_domain,
          title: article.title || null,
          excerpt: article.title || null, // GDELT doesn't provide excerpt in artlist mode
          body: null, // Not fetching full body for MVP
          published_at,
          cayman_flag: false, // Will be set by classifier
          signals: {},
          reasons: [],
          confidence: null,
          embedding: null,
          meta: {
            gdelt_domain: article.domain,
            gdelt_seendate: article.seendate,
            social_image: article.socialimage,
            source_country: article.sourcecountry,
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
            console.error(`Error upserting article ${canonical_url}:`, upsertError);
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
        skipped,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    console.log(`GDELT ingestion completed: ${stored} stored, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        fetched,
        stored,
        skipped,
        since,
        timespan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GDELT ingestion failed:', error);

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
