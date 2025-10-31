import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import type { ArticleDTO, ListArticlesResponse } from '../shared/monitor-types-simplified.ts';
import { articleRowToDTO } from '../shared/monitor-types-simplified.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ListArticlesSchema = z.object({
  signal: z.enum(['financial_decline', 'fraud', 'misstated_financials', 'shareholder_issues', 'director_duties', 'enforcement']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  source: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

function parseCursor(cursor: string): { timestamp: string; id: string } | null {
  try {
    const [timestamp, id] = cursor.split('|');
    if (!timestamp || !id) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}

function generateCursor(timestamp: string, id: string): string {
  return `${timestamp}|${id}`;
}

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

    let query = supabase
      .from('articles')
      .select('*')
      .eq('cayman_flag', true)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false });

    if (validated.signal) {
      query = query.eq(`signals->${validated.signal}`, true);
    }

    if (validated.from) {
      query = query.gte('published_at', validated.from);
    }
    if (validated.to) {
      query = query.lte('published_at', validated.to);
    }

    if (validated.source) {
      query = query.eq('source', validated.source);
    }

    if (validated.q) {
      query = query.or(`title.ilike.%${validated.q}%,excerpt.ilike.%${validated.q}%`);
    }

    if (validated.cursor) {
      const parsed = parseCursor(validated.cursor);
      if (parsed) {
        query = query.or(
          `published_at.lt.${parsed.timestamp},and(published_at.eq.${parsed.timestamp},id.lt.${parsed.id})`
        );
      }
    }

    query = query.limit(validated.limit + 1);

    const { data: articles, error } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    const hasMore = articles.length > validated.limit;
    const items = articles.slice(0, validated.limit);

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = generateCursor(lastItem.published_at, lastItem.id);
    }

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

async function handleStats(req: Request, supabase: any): Promise<Response> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('source, cayman_flag, signals, published_at')
      .gte('published_at', thirtyDaysAgo.toISOString())
      .eq('cayman_flag', true);

    if (error) {
      throw new Error(`Stats query failed: ${error.message}`);
    }

    const stats = {
      total_articles: articles?.length || 0,
      cayman_relevant: articles?.length || 0,
      by_signal: {
        financial_decline: 0,
        fraud: 0,
        misstated_financials: 0,
        shareholder_issues: 0,
        director_duties: 0,
        enforcement: 0,
      },
      by_source: {} as Record<string, number>,
      recent_24h: {
        total: 0,
        cayman_relevant: 0,
      },
      top_entities: [] as Array<{id: string; name: string; type: string; article_count: number}>,
    };

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    for (const article of articles || []) {
      if (article.signals) {
        if (article.signals.financial_decline) stats.by_signal.financial_decline++;
        if (article.signals.fraud) stats.by_signal.fraud++;
        if (article.signals.misstated_financials) stats.by_signal.misstated_financials++;
        if (article.signals.shareholder_issues) stats.by_signal.shareholder_issues++;
        if (article.signals.director_duties) stats.by_signal.director_duties++;
        if (article.signals.enforcement) stats.by_signal.enforcement++;
      }

      const source = article.source || 'unknown';
      stats.by_source[source] = (stats.by_source[source] || 0) + 1;

      const publishedDate = new Date(article.published_at);
      if (publishedDate >= twentyFourHoursAgo) {
        stats.recent_24h.total++;
        if (article.cayman_flag) {
          stats.recent_24h.cayman_relevant++;
        }
      }
    }

    const { data: topEntitiesData } = await supabase
      .from('article_entities')
      .select('entity_id, entities(id, name, type)')
      .limit(100);

    if (topEntitiesData) {
      const entityCounts = new Map<string, {id: string; name: string; type: string; count: number}>();
      
      for (const row of topEntitiesData) {
        if (row.entities) {
          const key = row.entity_id;
          const existing = entityCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            entityCounts.set(key, {
              id: row.entities.id,
              name: row.entities.name,
              type: row.entities.type,
              count: 1,
            });
          }
        }
      }

      stats.top_entities = Array.from(entityCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          article_count: e.count,
        }));
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`${req.method} ${path}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    if (path.includes('/articles') && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || anonKey;
      const supabase = createClient(supabaseUrl, token);
      return await handleListArticles(req, supabase);
    }

    if (path.includes('/stats') && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || anonKey;
      const supabase = createClient(supabaseUrl, token);
      return await handleStats(req, supabase);
    }

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