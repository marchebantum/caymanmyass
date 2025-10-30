import { createClient } from 'npm:@supabase/supabase-js@2';
import { formatError } from '../shared/monitor-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const signal = url.searchParams.get('signal');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const q = url.searchParams.get('q');
    const source = url.searchParams.get('source');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('Fetching articles with filters:', { signal, from, to, q, source, limit, offset });

    // Build query
    let query = supabase
      .from('monitor_articles')
      .select('*', { count: 'exact' })
      .eq('cayman_relevant', true)
      .eq('status', 'classified');

    // Apply filters
    if (signal) {
      // Filter by specific signal
      const signalColumn = `signal_${signal}`;
      query = query.eq(signalColumn, true);
    }

    if (from) {
      try {
        const fromDate = new Date(from).toISOString();
        query = query.gte('published_at', fromDate);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid date format for 'from' parameter`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (to) {
      try {
        const toDate = new Date(to).toISOString();
        query = query.lte('published_at', toDate);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid date format for 'to' parameter`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (q) {
      // Full-text search on title and content_snippet
      query = query.or(`title.ilike.%${q}%,content_snippet.ilike.%${q}%`);
    }

    if (source && (source === 'gdelt' || source === 'newsapi')) {
      query = query.eq('source_api', source);
    }

    // Apply pagination
    query = query
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: articles?.length || 0,
        total: count || 0,
        offset,
        limit,
        articles: articles || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching articles:', error);
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

