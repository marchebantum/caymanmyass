# GDELT Ingestion Schedule Setup

## Overview

The `ingest_gdelt` edge function can be scheduled to run automatically every 30 minutes using PostgreSQL's `pg_cron` extension.

## Prerequisites

1. **Deploy the edge function:**
   ```bash
   supabase functions deploy ingest_gdelt
   ```

2. **Get your credentials:**
   - Supabase Project Reference (from project URL)
   - Service Role Key (from Supabase Dashboard → Settings → API)

## Setup Steps

### Step 1: Enable pg_cron

Run in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Schedule the Job

Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values:

```sql
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '*/30 * * * *',  -- Every 30 minutes (at :00 and :30)
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
```

**Example with actual values:**
```sql
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://abcdefghij.supabase.co/functions/v1/ingest_gdelt',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'since', (now() - interval '1 hour')::text
      )
    ) AS request_id;
  $$
);
```

### Step 3: Verify the Schedule

Check that the job was created:

```sql
SELECT * FROM cron.job WHERE jobname = 'ingest-gdelt-every-30min';
```

You should see:
- `jobname`: `ingest-gdelt-every-30min`
- `schedule`: `*/30 * * * *`
- `active`: `t` (true)

## Manual Trigger (Testing)

Before relying on the schedule, test the function manually:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest_gdelt" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "run_id": "uuid-here",
  "fetched": 150,
  "stored": 25,
  "skipped": 125,
  "since": "2025-10-30T12:00:00.000Z",
  "timespan": "24h"
}
```

## Monitoring

### View Recent Runs

```sql
SELECT * FROM ingest_runs
WHERE source = 'gdelt'
ORDER BY started_at DESC
LIMIT 10;
```

### View Cron Job History

```sql
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'ingest-gdelt-every-30min'
)
ORDER BY start_time DESC 
LIMIT 10;
```

### Check for Errors

```sql
SELECT * FROM ingest_runs
WHERE source = 'gdelt' 
  AND status = 'failed'
ORDER BY started_at DESC;
```

## Schedule Modifications

### Change Frequency

**Every hour (at :00):**
```sql
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '0 * * * *',
  $$ ... $$
);
```

**Every 15 minutes:**
```sql
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '*/15 * * * *',
  $$ ... $$
);
```

**Every 6 hours:**
```sql
SELECT cron.schedule(
  'ingest-gdelt-every-30min',
  '0 */6 * * *',
  $$ ... $$
);
```

### Change Lookback Window

Edit the `body` parameter to adjust how far back to search:

**2 hours lookback:**
```sql
body := jsonb_build_object(
  'since', (now() - interval '2 hours')::text
)
```

**6 hours lookback:**
```sql
body := jsonb_build_object(
  'since', (now() - interval '6 hours')::text
)
```

## Pause/Resume Schedule

### Pause (disable without deleting)

```sql
UPDATE cron.job
SET active = false
WHERE jobname = 'ingest-gdelt-every-30min';
```

### Resume

```sql
UPDATE cron.job
SET active = true
WHERE jobname = 'ingest-gdelt-every-30min';
```

## Remove Schedule

To completely remove the scheduled job:

```sql
SELECT cron.unschedule('ingest-gdelt-every-30min');
```

## Troubleshooting

### Job not running

1. **Check if pg_cron is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check job is active:**
   ```sql
   SELECT jobname, active, schedule 
   FROM cron.job 
   WHERE jobname = 'ingest-gdelt-every-30min';
   ```

3. **Check recent execution attempts:**
   ```sql
   SELECT status, return_message, start_time
   FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ingest-gdelt-every-30min')
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

### Service role key issues

- Verify your service role key in Supabase Dashboard → Settings → API
- Key should start with `eyJ...`
- Do NOT use the anon key - it doesn't have sufficient permissions

### Network issues

- Ensure Supabase can make HTTP requests (check project settings)
- Verify edge function is deployed: `supabase functions list`

### Rate limiting

GDELT is free and has no official rate limits, but be considerate:
- Running every 30 minutes is reasonable
- Each run fetches up to 250 articles
- Most will be duplicates after the first few runs

## Cost Considerations

- **GDELT API**: Free, unlimited
- **Supabase pg_cron**: Included in Pro plan ($25/month)
- **Edge Function invocations**: 
  - Free tier: 500K invocations/month
  - Running every 30 minutes = ~1,440 invocations/month
  - Well within free tier limits

## Best Practices

1. **Start conservative**: Begin with 30-minute intervals
2. **Monitor first week**: Check `ingest_runs` table daily
3. **Adjust lookback**: Overlap slightly (1 hour lookback for 30-min schedule)
4. **Alert on failures**: Set up monitoring for `status = 'failed'`
5. **Review duplicates**: High `skipped` count is normal after initial ingestion

## Next Steps

After GDELT ingestion is running:
1. Implement `classify_articles` function
2. Schedule classification to run after ingestion
3. Implement `extract_entities` function
4. Chain all three in sequence for full pipeline

