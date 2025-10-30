# Cayman Monitor - Setup and Usage Guide

## Overview

Cayman Monitor is a feature that ingests global finance news articles from GDELT and NewsAPI, automatically classifies them for Cayman Islands relevance and risk signals, extracts entities, and provides a searchable interface for monitoring.

## Features

- **Automated News Ingestion**: Pulls articles from GDELT (free) and NewsAPI (requires key)
- **AI Classification**: Uses OpenAI GPT-4o-mini to classify articles for:
  - Financial decline/distress
  - Fraud and corruption
  - Misstated financials
  - Shareholder disputes
  - Director duties breaches
  - Regulatory investigations
- **Entity Extraction**: Identifies Cayman entities, registered office providers, and key people
- **Semantic Search**: pgvector integration for near-duplicate detection
- **REST API**: Query articles by signal, date range, entity, and more
- **Real-time Dashboard**: View, filter, and analyze all monitored articles

## Prerequisites

### Required API Keys

1. **NewsAPI Key** (optional but recommended)
   - Sign up at: https://newsapi.org/register
   - Free tier: 100 requests/day
   - Paid tier: $449/month for 250,000 requests

2. **OpenAI API Key** (required for classification)
   - Get from: https://platform.openai.com/api-keys
   - Pricing: ~$0.0008 per article (GPT-4o-mini)
   - Budget: ~$2.50/month for 100 articles/day

### System Requirements

- Supabase project with PostgreSQL 15+
- Node.js 18+ (for local development)
- pgvector extension enabled

## Installation Steps

### 1. Run Database Migration

Open Supabase Dashboard → SQL Editor and run:

```bash
# Navigate to your caymanmyass directory
cd caymanmyass

# Copy the migration SQL
cat supabase/migrations/20251031000000_create_monitor_schema.sql
```

Paste and execute the entire migration in the SQL Editor. This will:
- Enable the `pgvector` extension
- Create 5 tables: `monitor_articles`, `monitor_entities`, `monitor_article_entities`, `monitor_ingestion_runs`, `monitor_settings`
- Set up indexes for performance
- Configure RLS policies
- Initialize the `monitor_settings` singleton

**Verify Migration:**
```sql
SELECT * FROM monitor_settings;
-- Should return 1 row with default settings

SELECT * FROM pg_extension WHERE extname='vector';
-- Should confirm pgvector is enabled
```

### 2. Deploy Edge Functions

You need to deploy 8 edge functions to Supabase:

**Using Supabase CLI** (recommended):
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all Monitor functions
supabase functions deploy monitor-ingest-gdelt
supabase functions deploy monitor-ingest-newsapi
supabase functions deploy monitor-batch-classify
supabase functions deploy monitor-extract-entities
supabase functions deploy monitor-api-articles
supabase functions deploy monitor-api-entity-articles
supabase functions deploy monitor-api-stats
supabase functions deploy monitor-run-ingestion
```

**Using Supabase Dashboard:**
1. Navigate to Edge Functions → Create Function
2. For each function, copy contents from `supabase/functions/[function-name]/index.ts`
3. Deploy each function individually

### 3. Configure API Keys

Navigate to your caymanmyass app → Settings page:

1. Scroll to **Monitor Configuration** section (you may need to add this to your Settings page)
2. Enter your **NewsAPI Key** (optional but recommended)
3. Enter your **OpenAI API Key** (required)
4. Enable **NewsAPI Ingestion** if you have a key
5. Enable **Classification** (should be on by default)
6. Click **Save Settings**

Alternatively, update directly in database:
```sql
UPDATE monitor_settings
SET 
  newsapi_key = 'your-newsapi-key-here',
  newsapi_enabled = true,
  openai_api_key = 'sk-your-openai-key-here',
  classification_enabled = true
WHERE id = '00000000-0000-0000-0000-000000000002';
```

### 4. Set Up Scheduled Jobs (Optional)

For automated ingestion every 15-30 minutes, set up pg_cron jobs:

```sql
-- Ingestion job (every 15 minutes)
SELECT cron.schedule(
  'monitor-ingest-job',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/monitor-run-ingestion',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "all"}'::jsonb
  );
  $$
);

-- Classification job (every 30 minutes)
SELECT cron.schedule(
  'monitor-classify-job',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/monitor-batch-classify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Entity extraction job (every 30 minutes)
SELECT cron.schedule(
  'monitor-extract-entities-job',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/monitor-extract-entities',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- NewsAPI counter reset (daily at midnight UTC)
SELECT cron.schedule(
  'monitor-reset-newsapi-counter',
  '0 0 * * *',
  $$
  UPDATE monitor_settings 
  SET newsapi_requests_today = 0, 
      last_newsapi_reset = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';
  $$
);
```

**Verify cron jobs:**
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'monitor-%';
```

### 5. Seed Demo Data (Optional)

To test the UI before running real ingestion, insert test articles:

```sql
-- See supabase/migrations/20251031000000_create_monitor_schema.sql
-- for the full seed data SQL (search for "Demo Data")
-- Or use the seed queries provided in the plan documentation
```

### 6. Test the System

1. **Manual Ingestion Test:**
   - Navigate to Monitor page
   - Click "Run Ingestion Now"
   - Wait 1-2 minutes
   - Click "Refresh" to see new articles

2. **View Statistics:**
   - Return to Dashboard
   - View Monitor stats widget (if added)
   - Or navigate to Monitor page to see article counts

3. **Filter and Search:**
   - Use signal filters (fraud, financial_decline, etc.)
   - Set date ranges
   - Search by keywords
   - Click articles to view details

## Usage

### Monitor Page

Access at `/monitor` in your app. Features:

- **Search Bar**: Full-text search across titles and content
- **Filters**: 
  - Risk Signal (fraud, financial decline, etc.)
  - Source (GDELT, NewsAPI, or all)
  - Date range (from/to)
- **Article List**: Shows all Cayman-relevant articles with:
  - Title and source
  - Publication date
  - Risk signal badges
  - Extracted entities
  - Confidence score
- **Article Detail**: Click any article to view:
  - Full summary
  - Cayman relevance reasoning
  - Signal details with evidence quotes
  - All extracted entities
  - Link to original article

### Manual Ingestion

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-run-ingestion" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "all", "lookback_hours": 24}'
```

Parameters:
- `source`: "all", "gdelt", or "newsapi"
- `lookback_hours`: How many hours back to search (default: 24)

### Query Articles via API

```bash
# Get all fraud-related articles
curl "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-api-articles?signal=fraud" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Get articles from last week
curl "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-api-articles?from=2025-10-23T00:00:00Z" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Search for specific entity
curl "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-api-entity-articles?name=Walkers" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Get statistics
curl "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-api-stats" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Configuration

All settings are in the `monitor_settings` table (singleton with fixed ID).

### Key Settings:

- **gdelt_enabled**: Enable/disable GDELT ingestion (free, no key needed)
- **newsapi_enabled**: Enable/disable NewsAPI ingestion (requires key)
- **classification_enabled**: Enable/disable AI classification
- **lookback_hours**: How far back to search for articles (default: 24)
- **max_articles_per_run**: Max articles per ingestion (default: 100)
- **batch_size**: Articles classified per batch (default: 20)
- **classification_threshold**: Minimum confidence for relevance (default: 0.70)

**Update settings:**
```sql
UPDATE monitor_settings
SET 
  lookback_hours = 48,
  batch_size = 30,
  classification_threshold = 0.75
WHERE id = '00000000-0000-0000-0000-000000000002';
```

## Troubleshooting

### No articles appearing

**Check ingestion runs:**
```sql
SELECT * FROM monitor_ingestion_runs
ORDER BY started_at DESC
LIMIT 5;
```

Look for `errors` field for issues.

**Common causes:**
- NewsAPI key not set or invalid
- GDELT returning no results for time period
- Filters too restrictive (no Cayman keywords matched)

### Classification not running

**Check OpenAI key:**
```sql
SELECT openai_api_key, classification_enabled 
FROM monitor_settings;
```

**Check pending articles:**
```sql
SELECT COUNT(*) FROM monitor_articles
WHERE status = 'pending' AND classified = false;
```

If count > 0, manually trigger classification:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/monitor-batch-classify" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Rate limit errors

**NewsAPI:**
- Free tier limited to 100/day
- Check counter: `SELECT newsapi_requests_today FROM monitor_settings;`
- Resets daily at midnight UTC

**OpenAI:**
- Tier 1: 3,500 requests/min
- If hitting limits, reduce `batch_size` in settings

### High costs

**Monitor token usage:**
```sql
SELECT 
  COUNT(*) as articles_classified,
  SUM((llm_tokens_used->>'input_tokens')::int) as total_input,
  SUM((llm_tokens_used->>'output_tokens')::int) as total_output
FROM monitor_articles
WHERE llm_tokens_used IS NOT NULL;
```

**Cost calculation:**
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- Average article: ~1000 tokens input, ~200 tokens output = $0.00027

**To reduce costs:**
- Lower `lookback_hours` (less articles ingested)
- Lower `max_articles_per_run` (smaller batches)
- Disable NewsAPI (GDELT only, free)
- Increase `classification_threshold` (fewer false positives)

## Cost Estimates

**Free Tier (GDELT only, 50 articles/day):**
- GDELT: $0
- OpenAI Classification: $1.35/month
- Supabase: $0 (within free tier)
- **Total: ~$1.35/month**

**With NewsAPI Free Tier (100 articles/day):**
- GDELT: $0
- NewsAPI: $0 (100/day limit)
- OpenAI Classification: $2.70/month
- Supabase: $0 (within free tier)
- **Total: ~$2.70/month**

**Production (500 articles/day with NewsAPI paid):**
- GDELT: $0
- NewsAPI: $449/month
- OpenAI Classification: $13.50/month
- Supabase: ~$25/month (Pro tier for cron)
- **Total: ~$487.50/month**

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Query `monitor_ingestion_runs.errors` for ingestion issues
3. Review article `processing_errors` field
4. Check this troubleshooting guide

## API Reference

Full API documentation available in the plan file: `/cayman-monitor-implementation.plan.md`

Key endpoints:
- `GET /monitor-api-articles` - List articles with filters
- `GET /monitor-api-entity-articles` - Articles by entity
- `POST /monitor-run-ingestion` - Trigger ingestion
- `GET /monitor-api-stats` - Statistics overview

