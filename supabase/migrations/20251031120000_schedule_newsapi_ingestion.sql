-- Schedule NewsAPI ingestion to run every 2 hours
-- Free tier allows 100 requests/day, so 12 requests/day is conservative
-- NOTE: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values

-- Ensure pg_cron extension is enabled (should already be enabled from GDELT migration)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the NewsAPI ingestion job
-- Runs every 2 hours at :00
SELECT cron.schedule(
  'ingest-newsapi-every-2h',
  '0 */2 * * *',  -- Every 2 hours (at :00)
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_newsapi',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'since', (now() - interval '3 hours')::text,
        'pageSize', 50
      )
    ) AS request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job WHERE jobname = 'ingest-newsapi-every-2h';

-- To unschedule (if needed):
-- SELECT cron.unschedule('ingest-newsapi-every-2h');

-- To view job run history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ingest-newsapi-every-2h')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- View all monitor ingestion schedules:
-- SELECT jobname, schedule, active, command 
-- FROM cron.job 
-- WHERE jobname LIKE 'ingest-%'
-- ORDER BY jobname;

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for automated news ingestion';

