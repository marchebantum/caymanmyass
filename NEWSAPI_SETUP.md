# NewsAPI Ingestion Setup Guide

## Overview

The `ingest_newsapi` edge function integrates with NewsAPI.org to fetch English-language news articles related to Cayman Islands entities. It complements GDELT by providing access to premium news sources and more detailed article metadata.

## Prerequisites

### 1. Get NewsAPI Key

1. Visit https://newsapi.org/register
2. Sign up for a free account
3. Copy your API key (starts with a long alphanumeric string)
4. Free tier includes:
   - 100 requests per day
   - 100 articles per request
   - Articles from 150,000+ sources
   - 1 month of historical data

### 2. Set Environment Variable

Add your NewsAPI key to Supabase secrets:

```bash
supabase secrets set NEWSAPI_KEY=your-newsapi-key-here
```

Or via Supabase Dashboard:
1. Navigate to Edge Functions → Settings
2. Add secret: `NEWSAPI_KEY` = `your-key`

### 3. Optional: Configure Source Allowlist

To limit ingestion to specific trusted sources:

```bash
supabase secrets set ALLOW_SOURCES="reuters.com,bloomberg.com,ft.com,wsj.com"
```

**Recommended premium sources:**
- `reuters.com` - Reuters
- `bloomberg.com` - Bloomberg
- `ft.com` - Financial Times
- `wsj.com` - Wall Street Journal
- `bbc.com` - BBC News
- `theguardian.com` - The Guardian
- `apnews.com` - Associated Press
- `cnbc.com` - CNBC

If `ALLOW_SOURCES` is not set, all sources are accepted.

## Deployment

### Step 1: Deploy Edge Function

```bash
cd /Users/marchebantum/Desktop/AI/caymanmyass
supabase functions deploy ingest_newsapi
```

### Step 2: Test Manually

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/ingest_newsapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "run_id": "uuid-here",
  "fetched": 50,
  "stored": 15,
  "skipped": 35,
  "filtered": 0,
  "total_results": 150,
  "since": "2025-10-30T12:00:00.000Z",
  "page_size": 50,
  "allow_sources_enabled": false
}
```

### Step 3: Set Up Schedule

Edit `supabase/migrations/20251031120000_schedule_newsapi_ingestion.sql`:

1. Replace `YOUR_PROJECT_REF` with your Supabase project reference
2. Replace `YOUR_SERVICE_ROLE_KEY` with your service role key
3. Run in Supabase SQL Editor

The schedule runs every 2 hours (12 times/day), staying well under the 100 request/day limit.

### Step 4: Verify Schedule

```sql
-- Check scheduled job
SELECT * FROM cron.job WHERE jobname = 'ingest-newsapi-every-2h';

-- View recent runs
SELECT * FROM ingest_runs 
WHERE source = 'newsapi' 
ORDER BY started_at DESC 
LIMIT 10;

-- Count articles by source
SELECT source, COUNT(*) 
FROM articles 
GROUP BY source 
ORDER BY COUNT(*) DESC;
```

## Usage

### Basic Parameters

The function accepts these optional parameters:

```typescript
{
  since?: string;      // ISO 8601 date (default: 24h ago)
  q?: string;          // Additional query terms
  pageSize?: number;   // Articles per request (default: 50, max: 100)
}
```

### Example Requests

**Default (24 hours lookback, 50 articles):**
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/ingest_newsapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Custom time range (7 days):**
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/ingest_newsapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"since": "2025-10-24T00:00:00Z"}'
```

**Custom query (hedge funds only):**
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/ingest_newsapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "hedge fund OR investment fund"}'
```

**Max articles (100 per request):**
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/ingest_newsapi" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pageSize": 100}'
```

## Features

### Query Terms

Base Cayman query (automatically included):
```
Cayman Islands OR "Grand Cayman" OR "Cayman-registered" OR "Cayman-domiciled" OR CIMA
```

Custom queries are combined with AND logic:
```
(base Cayman query) AND (your custom query)
```

### Article Metadata

Each article is stored with:
- **url**: Article URL
- **url_hash**: SHA-256 hash for deduplication
- **source**: Domain (e.g., `reuters.com`)
- **title**: Article headline
- **excerpt**: Article description (from NewsAPI `description` field)
- **published_at**: ISO 8601 timestamp
- **meta**: NewsAPI-specific fields:
  - `newsapi_source_id`: Source identifier
  - `newsapi_source_name`: Full source name
  - `author`: Article author
  - `url_to_image`: Featured image URL
  - `content_preview`: Partial content (NewsAPI provides first 200 chars)

### Source Filtering

If `ALLOW_SOURCES` is configured:
1. Only articles from allowed domains are stored
2. Filtered articles are counted separately
3. Check response: `"filtered": 10` indicates 10 articles were excluded

**Example with filtering enabled:**
```json
{
  "success": true,
  "fetched": 50,
  "stored": 8,
  "skipped": 32,
  "filtered": 10,
  "allow_sources_enabled": true
}
```

### Deduplication

Same logic as GDELT:
- URL uniqueness via database constraint
- Duplicates are automatically skipped
- `skipped` count includes both database duplicates and filtered sources

## Rate Limiting

### Free Tier (100 requests/day)

**Recommended schedule:**
- **Every 2 hours**: 12 requests/day (recommended, 88 requests margin)
- **Every 3 hours**: 8 requests/day (conservative)
- **Every hour**: 24 requests/day (less margin)

**Do NOT schedule more frequently than every hour** on the free tier.

### Managing Usage

**Monitor daily usage:**
```sql
SELECT 
  DATE(started_at) as date,
  COUNT(*) as requests,
  SUM(fetched) as total_fetched,
  SUM(stored) as total_stored
FROM ingest_runs
WHERE source = 'newsapi'
  AND started_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

**Pause schedule if approaching limit:**
```sql
UPDATE cron.job
SET active = false
WHERE jobname = 'ingest-newsapi-every-2h';
```

**Resume:**
```sql
UPDATE cron.job
SET active = true
WHERE jobname = 'ingest-newsapi-every-2h';
```

### Paid Tier (Business Plan - $449/month)

If you upgrade:
- 250,000 requests per month (~8,000/day)
- Can increase frequency: every 15-30 minutes
- Adjust schedule in migration file

## Monitoring

### Check Recent Runs

```sql
SELECT 
  id,
  status,
  fetched,
  stored,
  skipped,
  started_at,
  finished_at,
  EXTRACT(EPOCH FROM (finished_at - started_at)) as duration_seconds
FROM ingest_runs
WHERE source = 'newsapi'
ORDER BY started_at DESC
LIMIT 10;
```

### Check for Failures

```sql
SELECT * FROM ingest_runs
WHERE source = 'newsapi' 
  AND status = 'failed'
ORDER BY started_at DESC;
```

### Source Breakdown

```sql
SELECT 
  source,
  COUNT(*) as article_count,
  MAX(published_at) as most_recent
FROM articles
GROUP BY source
ORDER BY article_count DESC
LIMIT 20;
```

### Compare GDELT vs NewsAPI

```sql
-- Articles by ingestion source
SELECT 
  CASE 
    WHEN meta->>'gdelt_domain' IS NOT NULL THEN 'gdelt'
    WHEN meta->>'newsapi_source_id' IS NOT NULL THEN 'newsapi'
    ELSE 'unknown'
  END as ingestion_source,
  COUNT(*) as count
FROM articles
GROUP BY ingestion_source;

-- Overlap analysis (same domain from both sources)
SELECT 
  source as domain,
  COUNT(*) as article_count,
  COUNT(CASE WHEN meta->>'gdelt_domain' IS NOT NULL THEN 1 END) as from_gdelt,
  COUNT(CASE WHEN meta->>'newsapi_source_id' IS NOT NULL THEN 1 END) as from_newsapi
FROM articles
GROUP BY source
HAVING COUNT(*) > 1
ORDER BY article_count DESC;
```

## Troubleshooting

### Error: "NEWSAPI_KEY not configured"

**Solution:**
```bash
supabase secrets set NEWSAPI_KEY=your-key-here
supabase functions deploy ingest_newsapi  # Redeploy after setting secret
```

### Error: "NewsAPI returned error status"

Common NewsAPI errors:

**`apiKeyInvalid`**: Your API key is incorrect
- Verify key in NewsAPI dashboard
- Check for extra spaces or characters
- Regenerate key if needed

**`rateLimited`**: Exceeded 100 requests/day
- Reduce schedule frequency
- Decrease pageSize parameter
- Upgrade to paid tier

**`maximumResultsReached`**: Requested too many results
- Reduce `pageSize` (max is 100)
- Use narrower date range

### No Articles Stored

**Check if NewsAPI has Cayman articles:**
```bash
curl "https://newsapi.org/v2/everything?q=Cayman+Islands&language=en&pageSize=5&apiKey=YOUR_KEY"
```

**Check allow sources filter:**
```bash
# List current filter
supabase secrets list | grep ALLOW_SOURCES

# Disable filter temporarily
supabase secrets unset ALLOW_SOURCES
```

### High Filtered Count

If `filtered` count is high:
1. Review your `ALLOW_SOURCES` list
2. Check which sources NewsAPI is returning:
   ```sql
   SELECT meta->>'newsapi_source_name', COUNT(*)
   FROM articles
   WHERE meta->>'newsapi_source_id' IS NOT NULL
   GROUP BY meta->>'newsapi_source_name'
   ORDER BY COUNT(*) DESC;
   ```
3. Add valuable sources to allowlist

## Cost Optimization

### Free Tier Strategy

**Maximize value within 100 requests/day:**

1. **Run every 2 hours** (12 requests/day)
2. **Use pageSize=50** (600 articles/day max)
3. **Enable ALLOW_SOURCES** for premium sources only
4. **Use narrow time windows** (2-3 hours lookback)

**Expected coverage:**
- 50-100 new Cayman articles per day
- 80-90% will be duplicates after first week
- 5-15 new articles stored per day

### Paid Tier Strategy

If you upgrade to Business plan ($449/month):

1. **Run every 30 minutes** (48 requests/day)
2. **Use pageSize=100** (4,800 articles/day max)
3. **Broader queries** for comprehensive coverage
4. **Longer lookback** (6-12 hours)

## Integration with Pipeline

### Sequential Processing

After ingestion completes, trigger classification:

```sql
-- In pg_cron schedule, chain the calls
SELECT net.http_post(url := '.../ingest_newsapi', ...);
SELECT net.http_post(url := '.../classify_articles', ...);
SELECT net.http_post(url := '.../extract_entities', ...);
```

Or use the monitor_api orchestration endpoint (to be implemented).

### Parallel with GDELT

Both GDELT and NewsAPI can run in parallel:
- GDELT: Every 30 minutes
- NewsAPI: Every 2 hours
- Classification: Every 30 minutes (processes articles from both)

## Best Practices

1. **Start conservative**: Begin with every 2 hours
2. **Monitor usage**: Track daily request count
3. **Filter sources**: Use ALLOW_SOURCES for quality
4. **Overlap with GDELT**: 1-2 hour lookback on 2-hour schedule
5. **Alert on failures**: Set up monitoring for failed runs
6. **Review relevance**: Check which sources provide best Cayman coverage

## Next Steps

After NewsAPI ingestion is running:
1. Monitor for 24-48 hours
2. Implement `classify_articles` function
3. Schedule classification pipeline
4. Analyze source quality and adjust allowlist
5. Consider upgrading if hitting rate limits

## Support

- NewsAPI Documentation: https://newsapi.org/docs
- NewsAPI Support: support@newsapi.org
- Check status: https://status.newsapi.org/

