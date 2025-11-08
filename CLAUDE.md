# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cayman Watch** is an automated legal and financial monitoring system for tracking Cayman Islands court proceedings, government gazette publications, and global financial news. The application combines web scraping, AI-powered document analysis, and multi-source news ingestion into a unified monitoring platform.

### Core Systems

1. **Court Registry Monitor** - Scrapes judicial.ky for Financial Services cases, analyzes PDFs with dual-LLM pipeline (OpenAI + Anthropic)
2. **Gazette Processor** - Extracts liquidation appointments from government gazette PDFs using Claude Sonnet 4
3. **News Monitor** - Multi-source ingestion (GDELT + NewsAPI), AI classification with 6 risk signals, entity extraction

## Architecture

**Stack**: React 18 + TypeScript + Vite (frontend) | Supabase (PostgreSQL + Edge Functions) | Deno runtime (serverless)

**Database**: 14 core tables across 3 systems (registry, gazette, news monitor) with RLS policies and comprehensive indexing

**External APIs**: Firecrawl (scraping), OpenAI GPT-4o-mini (chunked analysis), Anthropic Claude Sonnet 4 (consolidation), GDELT + NewsAPI (news)

## Common Development Commands

### Frontend Development
```bash
# Start dev server (http://localhost:5173)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

### Backend (Supabase Edge Functions)
```bash
# Deploy a single function
supabase functions deploy <function-name>

# Deploy all functions
supabase functions deploy scrape-registry
supabase functions deploy extract-pdf-text
supabase functions deploy analyze-case
supabase functions deploy analyze-pdf-with-claude
supabase functions deploy analyze-gazette-with-claude
supabase functions deploy ingest_gdelt
supabase functions deploy ingest_newsapi
supabase functions deploy classify_articles
supabase functions deploy extract_entities
supabase functions deploy monitor_api

# View function logs
supabase functions logs <function-name>
```

### Testing
```bash
# Test GDELT ingestion
./test-ingest-gdelt.sh

# Test NewsAPI ingestion
./test-ingest-newsapi.sh

# Test article classification
./test-classify-articles.sh

# Test entity extraction
./test-extract-entities.sh

# Test Monitor API
./test-monitor-api.sh
```

### Database Operations
```bash
# Link to Supabase project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push

# Reset database (DESTRUCTIVE - dev only)
supabase db reset
```

## Key Architecture Patterns

### Dual-LLM Pipeline (Court Registry)
The registry PDF analysis uses a cost-optimized dual-LLM approach:
1. **Chunking**: Split PDF text into 6000-char segments
2. **OpenAI GPT-4o-mini**: Process each chunk independently (~$0.0003 per chunk)
3. **Anthropic Claude Sonnet 4**: Consolidate chunk summaries into final analysis (~$0.006-$0.03 per case)
4. **Quality Scoring**: Calculate extraction quality (0-100), flag < 60 for manual review

Files: `supabase/functions/analyze-case/index.ts`

### News Monitor Pipeline (3-Stage)
1. **Ingestion**: GDELT (every 30 min) + NewsAPI (every 2 hours) → URL-based deduplication
2. **Classification**: Pre-filter heuristics (12 keywords + 12 RO providers, saves 60-70% cost) → Batch LLM classification (12 articles/call) → 6 risk signals
3. **Entity Extraction**: Extract from classifier metadata (99%) or LLM fallback → Normalize and link

Files: `supabase/functions/ingest_gdelt/`, `classify_articles/`, `extract_entities/`

### Fingerprinting for Deduplication
All scraped content uses fingerprint-based deduplication:
- **Registry**: Hash of `cause_number|filing_date|title|subject`
- **Gazette**: Hash of `kind|issue_number|issue_date`
- **News**: SHA-256 hash of URL

See `supabase/functions/scrape-registry/index.ts` for implementation.

### Database Relationships
```
registry_rows (1:0..1) → cases (with PDF bytes, analysis)
gazette_issues (1:*) → gazette_notices (liquidation appointments)
articles (*:*) → entities (via article_entities join table)
```

All tables use UUID primary keys, RLS policies (anonymous read, service role write), and auto-updating `updated_at` triggers.

## Critical Workflows

### Adding a New Edge Function
1. Create directory: `supabase/functions/<function-name>/`
2. Create `index.ts` with Deno imports:
   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   serve(async (req) => {
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     )
     // function logic
   })
   ```
3. Deploy: `supabase functions deploy <function-name>`
4. Test with curl or test script
5. Add pg_cron schedule if recurring (see existing schedule migrations)

### Modifying Database Schema
1. Create new migration: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Use `IF NOT EXISTS` for idempotency
3. Include RLS policies for new tables
4. Add indexes for query performance
5. Update `src/lib/database.types.ts` if needed (can regenerate with Supabase CLI)
6. Run migration in SQL Editor or `supabase db push`

### PDF Analysis Workflow
1. User uploads PDF via Registry page → `RegistryAnalyzerPanel.tsx`
2. Convert to Base64, POST to `analyze-pdf-with-claude`
3. Function stores in `cases.pdf_bytes`, calls `extract-pdf-text`
4. Extract text, check word count < 50 → trigger OCR if needed
5. Call `analyze-case` → chunk text, OpenAI processes chunks, Claude consolidates
6. Update `cases` table with `dashboard_summary`, `parsed_json`, quality score
7. If quality < 60, add to `review_queue`
8. Frontend displays "View Analysis" button, renders markdown summary

### News Monitoring Workflow
1. **Ingestion**: pg_cron triggers `ingest_gdelt` (every 30 min) and `ingest_newsapi` (every 2 hours)
2. Both normalize to same schema → `articles` table with URL deduplication
3. **Classification**: pg_cron triggers `classify_articles` (every 30 min at :15 and :45)
   - Fetch unclassified articles (where `signals = '{}'`)
   - Pre-filter with heuristics (cheap, 60-70% savings)
   - Batch LLM call (12 articles) → extract cayman_flag, signals, confidence
   - Update `articles` table
4. **Entity Extraction**: pg_cron triggers `extract_entities` (every 30 min at :20 and :50)
   - Extract from classifier metadata (primary)
   - LLM fallback if missing (rare)
   - Upsert to `entities`, link via `article_entities`

## Important Files & Locations

### Frontend Structure
- `src/pages/` - Route components (Dashboard, Registry, Gazettes, Notices, Monitor, Settings, ReviewQueue)
- `src/components/` - Reusable UI (Layout, analyzers, filters, renderers)
- `src/contexts/ThemeContext.tsx` - Dark mode state management
- `src/lib/supabase.ts` - Supabase client initialization
- `src/lib/database.types.ts` - TypeScript types for database tables

### Backend Structure
- `supabase/migrations/` - 40+ SQL migration files (chronological order)
- `supabase/functions/` - 24 Edge Functions organized by feature
- `supabase/functions/shared/` - Shared utilities (extraction patterns, monitor types)

### Documentation
- `MASTER_DOCUMENTATION.md` - Complete system reference (1700+ lines)
- `DATABASE_SCHEMA.md` - All 14 tables with columns, indexes, relationships
- `README_PIPELINE.md` - News monitor pipeline guide
- `IMPLEMENTATION_STATUS.md` - Project status tracker (90% complete, frontend pending)
- 30+ markdown docs for specific features/guides

### Configuration
- `.env` - Frontend environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `app_settings` table - Runtime config (singleton row, ID `00000000-0000-0000-0000-000000000001`)
  - API keys (Firecrawl, OpenAI, Anthropic, OCR)
  - Schedules (registry_schedule_time, lookback_days)
  - Feature flags (automation_enabled, firecrawl_enabled)

## Working with This Codebase

### When Adding Features
1. Check `IMPLEMENTATION_STATUS.md` for current state
2. Follow existing patterns (dual-LLM for expensive ops, fingerprinting for dedup)
3. Add RLS policies for new tables (anonymous read, service role write)
4. Include comprehensive error handling in Edge Functions
5. Create test script following `test-*.sh` pattern
6. Update relevant documentation

### When Debugging
1. **Frontend errors**: Check browser console, verify Supabase connection
2. **Edge Function errors**: Check Supabase Dashboard → Edge Functions → Logs
3. **Database issues**: Query `audit_log`, `scrape_jobs`, `ingest_runs` for history
4. **Missing data**: Check pg_cron jobs active: `SELECT * FROM cron.job`
5. **Cost issues**: Review `llm_tokens_used` in `cases` and classification logs

### Code Style
- TypeScript strict mode enabled
- Use async/await, not promises.then()
- Database queries via Supabase client, not raw SQL in Edge Functions
- Components use functional React with hooks
- TailwindCSS for styling (utility-first)
- Dark mode via `ThemeContext` (check `theme` value)

### Testing Strategy
1. **Manual testing via UI**: Primary method for user flows
2. **Test scripts**: Automated bash scripts for Edge Functions
3. **Database testing**: SQL queries in Supabase SQL Editor
4. **Scraper testing**: Built-in test panel in Settings page (dry run vs. live)

## Security & Best Practices

### Row Level Security (RLS)
All tables have RLS enabled:
- **Anonymous role** (frontend): SELECT only on public data
- **Authenticated role**: Not used (public monitoring system)
- **Service role** (Edge Functions): Full access, bypasses RLS
- **app_settings**: No anonymous access (contains API keys)

### API Key Management
- Never commit API keys to Git
- Store in `app_settings` table (encrypted at rest)
- Access via Edge Functions only (service role)
- Frontend never sees API keys

### Cost Optimization
Current system runs at **~$2.40/month** (MVP scale):
- GDELT: Free, unlimited
- NewsAPI: Free tier (100/day)
- OpenAI: ~$2.40/month (100 classified articles/day)
- Pre-filter heuristics save 60-70% on LLM costs

Scale estimate (1000 articles/day): ~$500/month (NewsAPI paid + OpenAI + Supabase Pro)

## Common Tasks

### To add a new risk signal to the news monitor:
1. Update `SignalFlags` type in `supabase/functions/shared/monitor-types-simplified.ts`
2. Modify prompt in `supabase/functions/classify_articles/classifier-prompt.ts`
3. Redeploy: `supabase functions deploy classify_articles`
4. Update frontend filters in `MonitorFilters.tsx` (when implemented)

### To change the classification schedule:
1. Edit migration: `supabase/migrations/20251031130000_schedule_classification.sql`
2. Update cron expression (currently `15,45 * * * *`)
3. Drop old job: `SELECT cron.unschedule('classify-articles-30min')`
4. Re-run migration in SQL Editor

### To add a new Cayman keyword:
1. Edit `CAYMAN_KEYWORDS` in `supabase/functions/classify_articles/cayman-heuristics.ts`
2. Redeploy: `supabase functions deploy classify_articles`
3. Monitor impact on classification rate in `ingest_runs` table

### To increase/decrease batch size:
1. Modify `ARTICLES_PER_BATCH` in `supabase/functions/classify_articles/index.ts`
2. Balance: Larger = fewer API calls but higher token cost per call
3. Redeploy function
4. Monitor token usage in logs

## Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **GDELT API**: http://blog.gdeltproject.org/
- **NewsAPI**: https://newsapi.org/docs
- **OpenAI API**: https://platform.openai.com/docs
- **Anthropic API**: https://docs.anthropic.com

## Project Status

- **Court Registry Monitor**: ✅ 100% complete
- **Gazette Processor**: ✅ 100% complete
- **News Monitor Backend**: ✅ 100% complete (pipeline + API)
- **Frontend Monitor UI**: ⏳ 0% (next priority)

The backend is production-ready and fully operational. The next task is building the Monitor page UI components to display classified articles with filtering, search, and entity exploration.
