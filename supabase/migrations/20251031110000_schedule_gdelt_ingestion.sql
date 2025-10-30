-- Schedule GDELT ingestion to run every 30 minutes
-- NOTE: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the GDELT ingestion job
-- Runs at 00 and 30 minutes past every hour
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_gdelt',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'since', (now() - interval '1 hour')::text
      )
    ) AS request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job WHERE jobname = 'ingest-gdelt-every-30min';

-- To unschedule (if needed):
-- SELECT cron.unschedule('ingest-gdelt-every-30min');

-- To view job run history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ingest-gdelt-every-30min')
-- ORDER BY start_time DESC 
-- LIMIT 10;

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for automated GDELT ingestion';

