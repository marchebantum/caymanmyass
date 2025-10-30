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

    console.log('Fetching monitor statistics...');

    // Total articles
    const { count: totalArticles } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true });

    // Cayman relevant articles
    const { count: caymanRelevant } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .eq('cayman_relevant', true);

    const caymanPercentage = totalArticles
      ? ((caymanRelevant || 0) / totalArticles) * 100
      : 0;

    // Articles by signal
    const bySignal: Record<string, number> = {};
    const signals = [
      'financial_decline',
      'fraud',
      'misstated_financials',
      'shareholder_dispute',
      'director_duties',
      'regulatory_investigation',
    ];

    for (const signal of signals) {
      const { count } = await supabase
        .from('monitor_articles')
        .select('*', { count: 'exact', head: true })
        .eq(`signal_${signal}`, true);
      bySignal[signal] = count || 0;
    }

    // Articles by source
    const { data: sourceStats } = await supabase
      .from('monitor_articles')
      .select('source_api');

    const bySource: Record<string, number> = {
      gdelt: 0,
      newsapi: 0,
    };

    if (sourceStats) {
      for (const article of sourceStats) {
        bySource[article.source_api] = (bySource[article.source_api] || 0) + 1;
      }
    }

    // Recent 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: recent24hTotal } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .gte('ingested_at', twentyFourHoursAgo);

    const { count: recent24hCayman } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .gte('ingested_at', twentyFourHoursAgo)
      .eq('cayman_relevant', true);

    const { count: recent24hHighPriority } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .gte('ingested_at', twentyFourHoursAgo)
      .eq('requires_review', true);

    // Top entities
    const { data: topEntities } = await supabase
      .from('monitor_entities')
      .select('id, entity_name, entity_type, article_count')
      .order('article_count', { ascending: false })
      .limit(10);

    // Last ingestion
    const { data: lastIngestion } = await supabase
      .from('monitor_ingestion_runs')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Classification health
    const { count: pending } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: classifiedToday } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'classified')
      .gte('classified_at', todayStart.toISOString());

    const { data: avgConfidenceData } = await supabase
      .from('monitor_articles')
      .select('cayman_confidence')
      .eq('cayman_relevant', true)
      .not('cayman_confidence', 'is', null);

    const avgConfidence = avgConfidenceData && avgConfidenceData.length > 0
      ? avgConfidenceData.reduce((sum, a) => sum + (a.cayman_confidence || 0), 0) / avgConfidenceData.length
      : 0;

    const { count: requiresReview } = await supabase
      .from('monitor_articles')
      .select('*', { count: 'exact', head: true })
      .eq('requires_review', true);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_articles: totalArticles || 0,
          cayman_relevant: caymanRelevant || 0,
          cayman_percentage: parseFloat(caymanPercentage.toFixed(1)),
          by_signal: bySignal,
          by_source: bySource,
          recent_24h: {
            total: recent24hTotal || 0,
            cayman_relevant: recent24hCayman || 0,
            high_priority: recent24hHighPriority || 0,
          },
          top_entities: (topEntities || []).map(e => ({
            id: e.id,
            name: e.entity_name,
            type: e.entity_type,
            article_count: e.article_count,
          })),
          last_ingestion: lastIngestion
            ? {
                run_id: lastIngestion.id,
                source_api: lastIngestion.source_api,
                completed_at: lastIngestion.completed_at,
                articles_new: lastIngestion.articles_new,
                articles_cayman_relevant: lastIngestion.articles_cayman_relevant,
              }
            : null,
          classification_health: {
            pending: pending || 0,
            classified_today: classifiedToday || 0,
            avg_confidence: parseFloat(avgConfidence.toFixed(2)),
            requires_review: requiresReview || 0,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching stats:', error);
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

