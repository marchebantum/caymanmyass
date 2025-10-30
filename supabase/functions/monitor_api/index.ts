import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import type { ArticleDTO, ListArticlesResponse } from '../shared/monitor-types-simplified.ts';
import { articleRowToDTO } from '../shared/monitor-types-simplified.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Validation schemas
const ListArticlesSchema = z.object({
  signal: z.enum(['financial_decline', 'fraud', 'misstated_financials', 'shareholder_issues', 'director_duties', 'enforcement']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  source: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

const IngestRunSchema = z.object({
  sources: z.array(z.enum(['gdelt', 'newsapi'])).optional().default(['gdelt', 'newsapi']),
});

/**
 * Parse cursor: "timestamp|id"
 */
function parseCursor(cursor: string): { timestamp: string; id: string } | null {
  try {
    const [timestamp, id] = cursor.split('|');
    if (!timestamp || !id) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Generate cursor: "timestamp|id"
 */
function generateCursor(timestamp: string, id: string): string {
  return `${timestamp}|${id}`;
}

/**
 * GET /v1/monitor/articles
 */
async function handleListArticles(req: Request, supabase: any): Promise<Response> {
  try {
    const url = new URL(req.url);
    const params = {
      signal: url.searchParams.get('signal') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      q: url.searchParams.get('q') || undefined,
      source: url.searchParams.get('source') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '25'),
      cursor: url.searchParams.get('cursor') || undefined,
    };

    const validated = ListArticlesSchema.parse(params);

    // Build query
    let query = supabase
      .from('articles')
      .select('*')
      .eq('cayman_flag', true)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false });

    // Signal filter
    if (validated.signal) {
      query = query.eq(`signals->${validated.signal}`, true);
    }

    // Date range filter
    if (validated.from) {
      query = query.gte('published_at', validated.from);
    }
    if (validated.to) {
      query = query.lte('published_at', validated.to);
    }

    // Source filter
    if (validated.source) {
      query = query.eq('source', validated.source);
    }

    // Search filter (ILIKE on title and excerpt)
    if (validated.q) {
      query = query.or(`title.ilike.%${validated.q}%,excerpt.ilike.%${validated.q}%`);
    }

    // Cursor pagination
    if (validated.cursor) {
      const parsed = parseCursor(validated.cursor);
      if (parsed) {
        query = query.or(
          `published_at.lt.${parsed.timestamp},and(published_at.eq.${parsed.timestamp},id.lt.${parsed.id})`
        );
      }
    }

    // Fetch limit + 1 to check if there are more results
    query = query.limit(validated.limit + 1);

    const { data: articles, error } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    const hasMore = articles.length > validated.limit;
    const items = articles.slice(0, validated.limit);

    // Generate next cursor
    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = generateCursor(lastItem.published_at, lastItem.id);
    }

    // Convert to DTOs
    const dtos: ArticleDTO[] = items.map(articleRowToDTO);

    const response: ListArticlesResponse = {
      items: dtos,
      next_cursor: nextCursor,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in handleListArticles:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /v1/monitor/entities/:name/articles
 */
async function handleEntityArticles(req: Request, supabase: any): Promise<Response> {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const entityName = decodeURIComponent(pathParts[pathParts.length - 2]);

    if (!entityName) {
      throw new Error('Entity name is required');
    }

    console.log(`Looking up entity: ${entityName}`);

    // Find entity by name (case-insensitive)
    const { data: entities, error: entityError } = await supabase
      .from('entities')
      .select('id, name, type, canonical_name')
      .ilike('name', entityName)
      .limit(1);

    if (entityError) {
      throw new Error(`Entity lookup failed: ${entityError.message}`);
    }

    if (!entities || entities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Entity not found', entity: entityName }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const entity = entities[0];

    // Get articles linked to this entity
    const { data: articleLinks, error: linksError } = await supabase
      .from('article_entities')
      .select('article_id, role')
      .eq('entity_id', entity.id);

    if (linksError) {
      throw new Error(`Article links lookup failed: ${linksError.message}`);
    }

    if (!articleLinks || articleLinks.length === 0) {
      return new Response(
        JSON.stringify({
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            canonical_name: entity.canonical_name,
          },
          articles: [],
          count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const articleIds = articleLinks.map(link => link.article_id);

    // Fetch articles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('*')
      .in('id', articleIds)
      .order('published_at', { ascending: false })
      .limit(50);

    if (articlesError) {
      throw new Error(`Articles lookup failed: ${articlesError.message}`);
    }

    // Convert to DTOs
    const dtos: ArticleDTO[] = (articles || []).map(articleRowToDTO);

    return new Response(
      JSON.stringify({
        entity: {
          id: entity.id,
          name: entity.name,
          type: entity.type,
          canonical_name: entity.canonical_name,
        },
        articles: dtos,
        count: dtos.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleEntityArticles:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * POST /v1/monitor/ingest/run
 */
async function handleIngestRun(req: Request, supabaseUrl: string, serviceRoleKey: string): Promise<Response> {
  try {
    const body = await req.json();
    const validated = IngestRunSchema.parse(body);

    console.log(`Manual ingestion requested for sources: ${validated.sources.join(', ')}`);

    const results: any = {
      sources: validated.sources,
      results: {},
    };

    // Invoke ingestion functions sequentially
    for (const source of validated.sources) {
      const functionName = source === 'gdelt' ? 'ingest_gdelt' : 'ingest_newsapi';
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

      try {
        console.log(`Invoking ${functionName}...`);

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${functionName} failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        results.results[source] = data;

        console.log(`✓ ${functionName} completed:`, data);
      } catch (error) {
        console.error(`✗ ${functionName} failed:`, error);
        results.results[source] = {
          success: false,
          error: String(error),
        };
      }
    }

    // Calculate totals
    const totals = {
      fetched: 0,
      stored: 0,
      skipped: 0,
    };

    for (const source of validated.sources) {
      const result = results.results[source];
      if (result?.success) {
        totals.fetched += result.fetched || 0;
        totals.stored += result.stored || 0;
        totals.skipped += result.skipped || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        totals,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleIngestRun:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /v1/monitor/stats
 */
async function handleStats(req: Request, supabase: any): Promise<Response> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all articles from last 30 days
    const { data: articles, error } = await supabase
      .from('articles')
      .select('source, cayman_flag, signals, published_at')
      .gte('published_at', thirtyDaysAgo.toISOString())
      .eq('cayman_flag', true);

    if (error) {
      throw new Error(`Stats query failed: ${error.message}`);
    }

    // Calculate stats
    const stats = {
      total_articles: articles?.length || 0,
      cayman_relevant: articles?.length || 0, // Already filtered by cayman_flag
      by_signal: {
        financial_decline: 0,
        fraud: 0,
        misstated_financials: 0,
        shareholder_issues: 0,
        director_duties: 0,
        enforcement: 0,
      },
      by_source: {} as Record<string, number>,
      date_range: {
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    };

    // Count by signal and source
    for (const article of articles || []) {
      // Count signals
      if (article.signals) {
        if (article.signals.financial_decline) stats.by_signal.financial_decline++;
        if (article.signals.fraud) stats.by_signal.fraud++;
        if (article.signals.misstated_financials) stats.by_signal.misstated_financials++;
        if (article.signals.shareholder_issues) stats.by_signal.shareholder_issues++;
        if (article.signals.director_duties) stats.by_signal.director_duties++;
        if (article.signals.enforcement) stats.by_signal.enforcement++;
      }

      // Count by source
      const source = article.source || 'unknown';
      stats.by_source[source] = (stats.by_source[source] || 0) + 1;
    }

    return new Response(
      JSON.stringify(stats),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleStats:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Main request handler
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`${req.method} ${path}`);

  // Determine which Supabase client to use
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    // Route: GET /v1/monitor/articles
    if (path.includes('/articles') && req.method === 'GET' && !path.match(/\/articles\/.+\/articles/)) {
      // Use authenticated client (anon key with user JWT)
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || anonKey;
      const supabase = createClient(supabaseUrl, token);
      return await handleListArticles(req, supabase);
    }

    // Route: GET /v1/monitor/entities/:name/articles
    if (path.match(/\/entities\/.+\/articles/) && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || anonKey;
      const supabase = createClient(supabaseUrl, token);
      return await handleEntityArticles(req, supabase);
    }

    // Route: POST /v1/monitor/ingest/run (service_role only)
    if (path.includes('/ingest/run') && req.method === 'POST') {
      // Verify service_role key
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (token !== serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Service role key required.' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return await handleIngestRun(req, supabaseUrl, serviceRoleKey);
    }

    // Route: GET /v1/monitor/stats
    if (path.includes('/stats') && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || anonKey;
      const supabase = createClient(supabaseUrl, token);
      return await handleStats(req, supabase);
    }

    // Route not found
    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Request handler error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
