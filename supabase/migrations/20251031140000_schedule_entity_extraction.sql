-- Schedule entity extraction to run every 30 minutes
-- Processes classified articles and links entities
-- NOTE: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values

-- Ensure pg_cron extension is enabled (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the entity extraction job
-- Runs every 30 minutes at :20 and :50 (after classification at :15 and :45)
SELECT cron.schedule(
  'extract-entities-every-30min',
  '20,50 * * * *',  -- At :20 and :50 past every hour
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract_entities',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'limit', 100
      )
    ) AS request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job WHERE jobname = 'extract-entities-every-30min';

-- To unschedule (if needed):
-- SELECT cron.unschedule('extract-entities-every-30min');

-- To view job run history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'extract-entities-every-30min')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- View all monitor schedules in order:
-- SELECT jobname, schedule, active 
-- FROM cron.job 
-- WHERE jobname LIKE '%ingest%' OR jobname LIKE '%classify%' OR jobname LIKE '%extract%'
-- ORDER BY jobname;

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - automated ingestion, classification, and entity extraction';

