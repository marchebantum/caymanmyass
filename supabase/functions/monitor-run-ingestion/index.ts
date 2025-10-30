import { createClient } from 'npm:@supabase/supabase-js@2';
import { formatError } from '../shared/monitor-utils.ts';

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

    const body = await req.json().catch(() => ({}));
    const source = body.source || 'all'; // 'all', 'gdelt', or 'newsapi'
    const lookback_hours = body.lookback_hours;

    console.log(`Triggering ingestion: source=${source}, lookback=${lookback_hours || 'default'}`);

    const results: any[] = [];
    const errors: string[] = [];

    // Get Supabase URL and service role key for calling edge functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Trigger GDELT ingestion
    if (source === 'all' || source === 'gdelt') {
      try {
        console.log('Triggering GDELT ingestion...');
        const response = await fetch(`${supabaseUrl}/functions/v1/monitor-ingest-gdelt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lookback_hours,
            triggered_by: 'manual',
          }),
        });

        const result = await response.json();
        results.push({ source: 'gdelt', ...result });

        if (!result.success) {
          errors.push(`GDELT: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = formatError(error);
        errors.push(`GDELT: ${errorMsg}`);
        results.push({ source: 'gdelt', success: false, error: errorMsg });
      }
    }

    // Trigger NewsAPI ingestion
    if (source === 'all' || source === 'newsapi') {
      try {
        console.log('Triggering NewsAPI ingestion...');
        const response = await fetch(`${supabaseUrl}/functions/v1/monitor-ingest-newsapi`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lookback_hours,
            triggered_by: 'manual',
          }),
        });

        const result = await response.json();
        results.push({ source: 'newsapi', ...result });

        if (!result.success) {
          errors.push(`NewsAPI: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = formatError(error);
        errors.push(`NewsAPI: ${errorMsg}`);
        results.push({ source: 'newsapi', success: false, error: errorMsg });
      }
    }

    // Calculate estimated completion time (assume 5 minutes max)
    const estimatedCompletion = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Get the run ID from the first successful result
    const runId = results.find(r => r.run_id)?.run_id;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        run_id: runId || null,
        message: `Ingestion triggered for ${source}`,
        source,
        lookback_hours,
        started_at: new Date().toISOString(),
        estimated_completion: estimatedCompletion,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 202, // Accepted
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error triggering ingestion:', error);
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

