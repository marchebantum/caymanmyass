-- Schedule article classification to run every 30 minutes
-- Processes unclassified articles in batches
-- NOTE: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values

-- Ensure pg_cron extension is enabled (should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the classification job
-- Runs every 30 minutes at :15 and :45 (offset from ingestion jobs)
SELECT cron.schedule(
  'classify-articles-every-30min',
  '15,45 * * * *',  -- At :15 and :45 past every hour
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/classify_articles',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'limit', 50,
        'batch_size', 12
      )
    ) AS request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job WHERE jobname = 'classify-articles-every-30min';

-- To unschedule (if needed):
-- SELECT cron.unschedule('classify-articles-every-30min');

-- To view job run history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'classify-articles-every-30min')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- View all monitor schedules:
-- SELECT jobname, schedule, active 
-- FROM cron.job 
-- WHERE jobname LIKE '%ingest%' OR jobname LIKE '%classify%'
-- ORDER BY jobname;

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - automated ingestion and classification';

