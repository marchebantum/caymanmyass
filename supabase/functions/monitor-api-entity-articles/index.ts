import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeTitle, formatError } from '../shared/monitor-utils.ts';

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
    const name = url.searchParams.get('name');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Entity name parameter is required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching articles for entity: ${name}`);

    const normalized_name = normalizeTitle(name);

    // Fetch entity
    const { data: entity, error: entityError } = await supabase
      .from('monitor_entities')
      .select('*')
      .eq('normalized_name', normalized_name)
      .maybeSingle();

    if (entityError) {
      throw entityError;
    }

    if (!entity) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Entity not found: ${name}`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch articles linked to this entity
    const { data: links, error: linksError, count } = await supabase
      .from('monitor_article_entities')
      .select('article_id, confidence, mention_count, monitor_articles(*)', { count: 'exact' })
      .eq('entity_id', entity.id)
      .range(offset, offset + limit - 1);

    if (linksError) {
      throw linksError;
    }

    // Transform results
    const articles = (links || []).map(link => ({
      id: link.monitor_articles.id,
      title: link.monitor_articles.title,
      url: link.monitor_articles.url,
      published_at: link.monitor_articles.published_at,
      signals: link.monitor_articles.signals,
      mention_count: link.mention_count,
      confidence: link.confidence,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        entity: {
          id: entity.id,
          name: entity.entity_name,
          normalized_name: entity.normalized_name,
          entity_type: entity.entity_type,
          article_count: entity.article_count,
          first_seen: entity.first_seen,
          last_seen: entity.last_seen,
        },
        count: articles.length,
        total: count || 0,
        articles,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching entity articles:', error);
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

