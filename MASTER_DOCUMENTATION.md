# Cayman Watch - Comprehensive AI-Ready Documentation

**Version:** 1.0
**Last Updated:** October 18, 2025
**System Name:** Cayman Watch (Project: caymanmyass)
**Repository:** marchebantum/caymanmyass

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation Guide](#3-installation-guide)
4. [Application Architecture](#4-application-architecture)
5. [Configuration Reference](#5-configuration-reference)
6. [Operational Guide](#6-operational-guide)
7. [Development Information](#7-development-information)

---

## 1. Application Overview

### 1.1 Purpose and Core Functionality

**Cayman Watch** is an automated legal monitoring system designed to track and analyze court proceedings in the Cayman Islands. The application:

- **Monitors** the judicial.ky public registers for new Financial Services cases
- **Scrapes** petition and winding-up petition entries automatically
- **Extracts** text from PDF court documents using OCR when needed
- **Analyzes** case documents using AI (OpenAI GPT-4 + Anthropic Claude)
- **Generates** dashboard-ready summaries with structured data extraction
- **Notifies** users of new cases through a real-time dashboard
- **Tracks** liquidation appointments, financial information, and case timelines

### 1.2 Target Users and Use Cases

**Primary Users:**
- Legal professionals monitoring Cayman Islands insolvency proceedings
- Financial institutions tracking corporate liquidations
- Registered office providers monitoring client matters
- Compliance teams tracking regulatory filings

**Key Use Cases:**
1. **Automated Monitoring:** Daily checks for new petition filings
2. **Document Analysis:** AI-powered extraction of case details from PDFs
3. **Data Aggregation:** Centralized tracking of all Financial Services cases
4. **Gazette Monitoring:** Track official liquidation appointments
5. **Quality Assurance:** Review queue for low-confidence extractions

### 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  React SPA with TailwindCSS + Dark Mode Support                 │
│  Routes: Dashboard, Registry, Gazettes, Notices, Settings       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓ (Supabase Client SDK)
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │ Edge Functions│  │  Realtime    │         │
│  │  Database    │  │  (Deno)       │  │  Subscriptions│         │
│  │  + pg_cron   │  │  8 Functions  │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ↓ (External API Calls)
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  Firecrawl   │ │  OpenAI      │ │  Anthropic   │           │
│  │  Web Scraper │ │  GPT-4 Mini  │ │  Claude 4    │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│  ┌──────────────┐ ┌──────────────┐                             │
│  │  PDFRest     │ │  ConvertAPI  │                             │
│  │  OCR (opt)   │ │  OCR (opt)   │                             │
│  └──────────────┘ └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ↓ (Scrapes)
┌─────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                                  │
│  - judicial.ky/public-registers (Financial Services)            │
│  - Gazette PDF uploads (manual)                                 │
│  - Registry PDF uploads (manual)                                │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **Automated Scraping:** pg_cron triggers scrape-registry function daily at 7:00 AM
2. **Case Detection:** Firecrawl scrapes judicial.ky → parses HTML/Markdown → identifies new cases
3. **Notification:** New cases create dashboard notifications via Supabase Realtime
4. **Manual Upload:** User uploads PDF for new case via Registry page
5. **Text Extraction:** extract-pdf-text function processes PDF → uses OCR if needed
6. **AI Analysis:** analyze-case function uses OpenAI for chunking + Anthropic for consolidation
7. **Dashboard Display:** Structured data appears in Registry page with "View Analysis" button

### 1.4 Technology Stack

**Frontend:**
- **Framework:** React 18.3.1
- **Build Tool:** Vite 5.4.2
- **Routing:** React Router DOM 7.9.4
- **Styling:** TailwindCSS 3.4.1 + PostCSS + Autoprefixer
- **Icons:** Lucide React 0.344.0
- **Language:** TypeScript 5.5.3

**Backend:**
- **Platform:** Supabase (PostgreSQL + Edge Functions)
- **Runtime:** Deno (for Edge Functions)
- **Database:** PostgreSQL 15+ with pg_cron extension
- **Realtime:** Supabase Realtime (WebSocket subscriptions)

**External APIs:**
- **Web Scraping:** Firecrawl API (mendable/firecrawl-js v1)
- **AI Processing:** OpenAI API (gpt-4o-mini), Anthropic API (claude-sonnet-4)
- **OCR (Optional):** PDFRest or ConvertAPI
- **PDF Processing:** pdf.js-extract 0.2.1

**Development Tools:**
- ESLint 9.9.1 + TypeScript ESLint 8.3.0
- TypeScript 5.5.3
- Node.js (for development only)

---

## 2. System Requirements

### 2.1 Hardware Specifications

**Minimum Requirements:**
- **CPU:** 2 cores, 2 GHz
- **RAM:** 4 GB
- **Storage:** 10 GB free space
- **Network:** Stable internet connection (10 Mbps+)

**Recommended Requirements:**
- **CPU:** 4 cores, 3 GHz+
- **RAM:** 8 GB
- **Storage:** 50 GB free space (for PDF storage)
- **Network:** High-speed internet (50 Mbps+)

### 2.2 Operating System Compatibility

**Development Environment:**
- macOS 10.15+ (Catalina or later)
- Windows 10/11 with WSL2
- Linux (Ubuntu 20.04+, Debian 11+, or equivalent)

**Production Environment:**
- Runs entirely on Supabase Cloud (no OS requirements)
- Frontend can be deployed to any static hosting (Vercel, Netlify, AWS S3, etc.)

### 2.3 Software Dependencies

**Required for Development:**
- **Node.js:** v18.0.0 or later (v20+ recommended)
- **npm:** v9.0.0 or later (comes with Node.js)
- **Git:** v2.30.0 or later
- **Modern Browser:** Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+

**Required for Production:**
- **Supabase Account:** Free tier or paid plan
- **Supabase Project:** PostgreSQL database with pg_cron enabled
- **API Keys:** See Configuration section

### 2.4 Network Requirements

**Ports:**
- **Development:** Port 5173 (Vite dev server)
- **Production:** Port 443 (HTTPS only)

**Outbound Connections Required:**
- Supabase API: `*.supabase.co:443`
- Firecrawl API: `api.firecrawl.dev:443`
- OpenAI API: `api.openai.com:443`
- Anthropic API: `api.anthropic.com:443`
- OCR APIs: `api.pdfrest.com:443`, `v2.convertapi.com:443`
- Judicial Website: `judicial.ky:443`

**Firewall Requirements:**
- Allow outbound HTTPS (port 443) to all endpoints above
- Allow inbound HTTPS (port 443) for frontend access
- WebSocket support required for Supabase Realtime

### 2.5 Storage Requirements

**Database Storage:**
- Base schema: ~5 MB
- Per case (with PDF): ~500 KB - 5 MB
- Per gazette: ~2 MB - 10 MB
- Estimated for 1000 cases: ~2-5 GB

**Frontend Build:**
- Development node_modules: ~300 MB
- Production build: ~2 MB

---

## 3. Installation Guide

### 3.1 Prerequisites Checklist

Before installation, ensure you have:

- [ ] Supabase account created at https://supabase.com
- [ ] New Supabase project created
- [ ] Node.js v18+ installed (`node --version`)
- [ ] Git installed (`git --version`)
- [ ] Code editor (VS Code recommended)

### 3.2 Step-by-Step Setup

#### Step 1: Clone Repository

```bash
git clone https://github.com/marchebantum/caymanmyass.git
cd caymanmyass
```

#### Step 2: Install Dependencies

```bash
npm install
```

**Expected Output:**
```
added 500+ packages in 30s
```

#### Step 3: Configure Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**To get these values:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" → `VITE_SUPABASE_URL`
5. Copy "anon public" key → `VITE_SUPABASE_ANON_KEY`

#### Step 4: Database Setup

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order from `supabase/migrations/`
3. Start with `20251010104006_create_cayman_watch_schema.sql`
4. Continue in chronological order by filename

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Verify Database:**
```sql
-- Run in SQL Editor
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Should return 14 tables
```

#### Step 5: Deploy Edge Functions

**Using Supabase Dashboard:**

For each function in `supabase/functions/`:
1. Go to Edge Functions → New Function
2. Copy function name (e.g., `scrape-registry`)
3. Paste contents of `index.ts`
4. Click Deploy

**Using Supabase CLI:**
```bash
# Deploy all functions
supabase functions deploy scrape-registry
supabase functions deploy extract-pdf-text
supabase functions deploy analyze-case
supabase functions deploy analyze-pdf-with-claude
supabase functions deploy analyze-gazette-with-claude
supabase functions deploy capture-pdf
supabase functions deploy parse-gazette
supabase functions deploy scrape-gazette
supabase functions deploy send-notification
supabase functions deploy test-scraper
```

#### Step 6: Initialize App Settings

Run in Supabase SQL Editor:

```sql
INSERT INTO app_settings (
  id,
  ocr_provider,
  firecrawl_enabled,
  automation_enabled,
  registry_schedule_time,
  timezone,
  notification_enabled,
  lookback_days
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'pdfrest',
  false,
  true,
  '07:00',
  'America/Cayman',
  true,
  7
)
ON CONFLICT (id) DO NOTHING;
```

#### Step 7: Enable pg_cron Extension

Run in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Step 8: Configure Daily Automation

Run in Supabase SQL Editor:

```sql
-- Schedule daily scraping at 7:00 AM Cayman time
SELECT cron.schedule(
  'daily-registry-scrape',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/scrape-registry',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Replace:**
- `your-project.supabase.co` with your Supabase URL
- `YOUR_SERVICE_ROLE_KEY` with your service role key (Settings → API → service_role)

#### Step 9: Start Development Server

```bash
npm run dev
```

**Expected Output:**
```
VITE v5.4.2  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

#### Step 10: Verify Installation

1. Open http://localhost:5173
2. Dashboard should load with statistics
3. Go to Settings page
4. Add Firecrawl API key (get from https://firecrawl.dev)
5. Enable Firecrawl and save settings
6. Go to Settings → Scraper Testing
7. Run "Dry Run" test
8. Verify green checkmarks for all steps

### 3.3 Configuration File Examples

**.env (Required)**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Add for local development only
# Never commit these to Git!
```

**.env.example (Provided in repo)**
```env
# Copy this to .env and fill in your values
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**app_settings table (Runtime configuration)**
```json
{
  "ocr_provider": "pdfrest",
  "ocr_api_key": "encrypted_key",
  "firecrawl_api_key": "fc-xxxxx",
  "firecrawl_enabled": true,
  "automation_enabled": true,
  "openai_api_key": "sk-xxxxx",
  "anthropic_api_key": "sk-ant-xxxxx",
  "lookback_days": 7
}
```

### 3.4 Verification Steps

**Check 1: Database Tables**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
Expected: 14 tables including `registry_rows`, `cases`, `app_settings`, etc.

**Check 2: Edge Functions**
```bash
curl https://your-project.supabase.co/functions/v1/
```
Expected: Function list or 404 (not 500)

**Check 3: App Settings**
```sql
SELECT * FROM app_settings LIMIT 1;
```
Expected: 1 row with default settings

**Check 4: Frontend Build**
```bash
npm run build
```
Expected: No TypeScript errors, build succeeds

**Check 5: Frontend Access**
- Open http://localhost:5173
- Dashboard loads without errors
- Statistics show zeros (no data yet)
- No console errors in browser DevTools

### 3.5 Common Installation Issues

**Issue: "Missing Supabase environment variables"**
- **Cause:** `.env` file not created or incorrect values
- **Fix:** Verify `.env` file exists and contains correct URL and anon key

**Issue: "Database connection failed"**
- **Cause:** Incorrect Supabase URL or project not accessible
- **Fix:** Check project status in Supabase dashboard, verify URL

**Issue: "npm install fails"**
- **Cause:** Node.js version too old or network issues
- **Fix:** Update Node.js to v18+ and try again

**Issue: "Migrations fail to run"**
- **Cause:** Duplicate runs or syntax errors
- **Fix:** Migrations use `IF NOT EXISTS`, safe to re-run

**Issue: "Edge functions not deploying"**
- **Cause:** Syntax errors or missing dependencies
- **Fix:** Check function logs in Supabase dashboard

---

## 4. Application Architecture

### 4.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  React SPA (TypeScript + TailwindCSS)                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Dashboard   │  │   Registry   │  │   Gazettes   │         │
│  │  - Stats     │  │  - Cases     │  │  - Issues    │         │
│  │  - Jobs      │  │  - Upload    │  │  - Notices   │         │
│  │  - Alerts    │  │  - Analysis  │  │  - Upload    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Settings   │  │   Notices    │  │ Review Queue │         │
│  │  - API Keys  │  │  - List      │  │  - Flagged   │         │
│  │  - Schedule  │  │  - Filter    │  │  - Review    │         │
│  │  - Testing   │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  Shared Components:                                             │
│  - Layout (nav, header, dark mode toggle)                      │
│  - ThemeContext (dark/light mode state)                        │
│  - CaseSummaryRenderer (markdown → HTML)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase JS Client
                         │ (@supabase/supabase-js)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Edge Functions (Deno Runtime)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  scrape-registry                                 │           │
│  │  - Triggers: Manual, pg_cron (daily 7 AM)      │           │
│  │  - Calls: Firecrawl API                         │           │
│  │  - Parses: HTML/Markdown table                  │           │
│  │  - Filters: Financial Services, Petition types │           │
│  │  - Output: New registry_rows records            │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  extract-pdf-text                                │           │
│  │  - Input: case_id (references cases table)      │           │
│  │  - Extracts: Text from pdf_bytes using pdf.js   │           │
│  │  - OCR: Falls back if word count < 50           │           │
│  │  - Output: Updates cases.pdf_text                │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  analyze-case                                    │           │
│  │  - Input: case_id, pdf_text                     │           │
│  │  - Chunks: Splits text into 6000 char segments  │           │
│  │  - OpenAI: Processes each chunk (gpt-4o-mini)   │           │
│  │  - Anthropic: Consolidates summaries (Claude 4) │           │
│  │  - Output: dashboard_summary, parsed_json        │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  analyze-pdf-with-claude                         │           │
│  │  - Direct upload analysis for Registry PDFs      │           │
│  │  - Single-pass Claude analysis                   │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  analyze-gazette-with-claude                     │           │
│  │  - Gazette PDF analysis                          │           │
│  │  - Extracts liquidation notices                  │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌─────────────────────────────────────────────────┐           │
│  │  test-scraper                                    │           │
│  │  - Diagnostic testing endpoint                   │           │
│  │  - Dry run and live modes                        │           │
│  │  - Returns detailed logs                         │           │
│  └─────────────────────────────────────────────────┘           │
│                                                                  │
│  Other Functions: parse-gazette, scrape-gazette,                │
│                   capture-pdf, send-notification                │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL Queries
                         │ PostgreSQL Protocol
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 15+ with Extensions: pg_cron, pgvector (future)     │
│                                                                  │
│  Core Tables:                                                    │
│  ┌─────────────────┬─────────────────┬─────────────────┐       │
│  │ registry_rows   │ cases           │ gazette_issues  │       │
│  │ - cause_number  │ - pdf_bytes     │ - pdf_url       │       │
│  │ - filing_date   │ - pdf_text      │ - pdf_text      │       │
│  │ - status        │ - parsed_json   │ - parsed_count  │       │
│  │ - fingerprint   │ - analysis_md   │                 │       │
│  └─────────────────┴─────────────────┴─────────────────┘       │
│                                                                  │
│  Support Tables:                                                 │
│  ┌─────────────────┬─────────────────┬─────────────────┐       │
│  │ app_settings    │ scrape_jobs     │ notifications   │       │
│  │ - api_keys      │ - job_type      │ - title         │       │
│  │ - schedules     │ - status        │ - message       │       │
│  │ - automation    │ - metrics       │ - priority      │       │
│  └─────────────────┴─────────────────┴─────────────────┘       │
│                                                                  │
│  Analysis Tables:                                                │
│  ┌────────────────────┬──────────────────────────────┐         │
│  │ analyzed_registry  │ analyzed_gazette_pdfs        │         │
│  │ _pdfs              │ - gazette_type               │         │
│  │ - dashboard_summary│ - full_analysis              │         │
│  └────────────────────┴──────────────────────────────┘         │
│                                                                  │
│  Audit & Review:                                                 │
│  ┌─────────────────┬─────────────────┬─────────────────┐       │
│  │ review_queue    │ audit_log       │ scraper_test    │       │
│  │ - item_type     │ - table_name    │ _runs           │       │
│  │ - reason        │ - action        │ - test_logs     │       │
│  └─────────────────┴─────────────────┴─────────────────┘       │
│                                                                  │
│  Security: Row Level Security (RLS) enabled on all tables       │
│           Anonymous read access for public data                 │
│           Service role for Edge Functions                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Relationships and Data Flow

**Workflow 1: Automated Daily Scraping**

```
[pg_cron scheduler]
    │
    ├→ Triggers at 07:00 AM Cayman time
    │
    ↓
[scrape-registry Edge Function]
    │
    ├→ 1. Load app_settings (check firecrawl_enabled)
    ├→ 2. Call Firecrawl API with judicial.ky URL
    ├→ 3. Parse HTML/Markdown table
    ├→ 4. Filter: Financial Services + (Petition OR Winding Up)
    ├→ 5. Apply lookback_days filter (default 7 days)
    ├→ 6. Generate fingerprints for deduplication
    ├→ 7. Check against existing registry_rows
    ├→ 8. Insert new rows with status='awaiting_pdf'
    ├→ 9. Create scrape_jobs record
    ├→ 10. Create notification if new_rows > 0
    │
    ↓
[PostgreSQL: registry_rows table]
    │
    ├→ New records inserted
    │
    ↓
[Supabase Realtime]
    │
    ├→ Broadcasts INSERT event to subscribed clients
    │
    ↓
[Dashboard React Component]
    │
    ├→ Receives notification via WebSocket
    ├→ Displays banner with new case count
    └→ Shows cause numbers in notification
```

**Workflow 2: PDF Upload and Analysis**

```
[User clicks "Upload PDF" in Registry page]
    │
    ↓
[RegistryAnalyzerPanel Component]
    │
    ├→ 1. User selects cause_number from dropdown
    ├→ 2. User selects PDF file from file system
    ├→ 3. Reads file as ArrayBuffer
    ├→ 4. Converts to Base64
    │
    ↓
[analyze-pdf-with-claude Edge Function]
    │
    ├→ 1. Decode Base64 to PDF bytes
    ├→ 2. Store in cases.pdf_bytes
    ├→ 3. Call extract-pdf-text function
    │
    ↓
[extract-pdf-text Edge Function]
    │
    ├→ 1. Load pdf_bytes from cases table
    ├→ 2. Extract text using pdf.js-extract
    ├→ 3. Count words
    ├→ 4. IF word_count < 50:
    │   ├→ a. Load OCR settings
    │   ├→ b. Call PDFRest or ConvertAPI
    │   ├→ c. Replace text with OCR result
    │   └→ d. Set ocr_used=true, confidence='medium'
    ├→ 5. ELSE: confidence='high'
    ├→ 6. Update cases.pdf_text, extraction_confidence
    ├→ 7. Set status='text_extracted'
    │
    ↓
[analyze-case Edge Function]
    │
    ├→ 1. Load cases.pdf_text
    ├→ 2. Split into 6000-character chunks
    ├→ 3. FOR EACH chunk:
    │   ├→ a. Call OpenAI API (gpt-4o-mini)
    │   ├→ b. Extract structured data per DASHBOARD_PROMPT
    │   └→ c. Accumulate chunk summaries
    ├→ 4. Consolidate with Anthropic Claude 4
    ├→ 5. Parse into sections:
    │   ├→ - Company Overview
    │   ├→ - Legal Details
    │   ├→ - Key Timeline
    │   ├→ - Financial Summary
    │   └→ - Insolvency Practitioners
    ├→ 6. Calculate extraction_quality_score
    ├→ 7. Determine requires_review flag
    ├→ 8. Update cases table with all analysis data
    ├→ 9. Update registry_rows.status='analyzed'
    │
    ↓
[PostgreSQL: cases + registry_rows tables updated]
    │
    ↓
[Registry Page]
    │
    ├→ Status badge changes to "analyzed"
    ├→ "View Analysis" button becomes visible
    └→ User clicks → Modal displays dashboard_summary
```

### 4.3 Database Schema

See `DATABASE_SCHEMA.md` for complete details. Key relationships:

```
registry_rows (1) ──→ (0..1) cases
    │                      │
    │                      └→ Contains: pdf_bytes, pdf_text, analysis
    │
    └→ PK: id (uuid)
       UK: cause_number
       UK: row_fingerprint

cases (1) ──→ (0..1) review_queue
    │                   └→ When: requires_review=true

gazette_issues (1) ──→ (*) gazette_notices
    │                       └→ Extracted liquidation appointments
    │
    └→ PK: id (uuid)

scrape_jobs (*) ──→ (1) app_settings
    │                    └→ References: triggered_by, schedule info
    │
    └→ Tracks all scraping runs

app_settings (singleton)
    └→ id: '00000000-0000-0000-0000-000000000001'
       Contains: All API keys and configuration
```

### 4.4 API Endpoints and Interfaces

**Supabase Edge Functions Base URL:**
```
https://[project-ref].supabase.co/functions/v1/
```

**Authentication:**
All requests require `Authorization: Bearer [SUPABASE_ANON_KEY]` header.

**Endpoints:**

1. **POST /scrape-registry**
   - **Purpose:** Trigger manual registry scraping
   - **Input:** None (reads from app_settings)
   - **Output:**
     ```json
     {
       "success": true,
       "total_rows": 150,
       "recent_rows": 25,
       "new_rows": 3,
       "new_cause_numbers": ["FSD-123/2024", "FSD-124/2024"],
       "lookback_days": 7,
       "mode": "firecrawl"
     }
     ```

2. **POST /extract-pdf-text**
   - **Purpose:** Extract text from PDF in cases table
   - **Input:** `{ "case_id": "uuid" }`
   - **Output:**
     ```json
     {
       "success": true,
       "case_id": "uuid",
       "text_length": 15000,
       "word_count": 2500,
       "ocr_used": false,
       "confidence": "high"
     }
     ```

3. **POST /analyze-case**
   - **Purpose:** AI analysis of extracted text
   - **Input:** `{ "case_id": "uuid" }`
   - **Output:**
     ```json
     {
       "success": true,
       "case_id": "uuid",
       "dashboard_summary": "# 1. COMPANY OVERVIEW...",
       "tokens_used": {
         "openai_tokens": 5000,
         "anthropic_tokens": 2000,
         "total_cost": 0.11
       },
       "quality_score": 85
     }
     ```

4. **POST /analyze-pdf-with-claude**
   - **Purpose:** Direct upload and analysis
   - **Input:**
     ```json
     {
       "cause_number": "FSD-123/2024",
       "pdf_base64": "JVBERi0xLjQK...",
       "registry_row_id": "uuid"
     }
     ```
   - **Output:** Same as analyze-case

5. **POST /test-scraper**
   - **Purpose:** Diagnostic testing with detailed logs
   - **Input:**
     ```json
     {
       "mode": "dry_run",  // or "live"
       "triggered_by": "manual_test"
     }
     ```
   - **Output:**
     ```json
     {
       "success": true,
       "test_run_id": "uuid",
       "summary": "Test completed successfully",
       "total_steps": 7,
       "successful_steps": 7,
       "logs": [...]
     }
     ```

### 4.5 Security Architecture

**Authentication:**
- No user authentication required (public monitoring system)
- All data is public information from judicial.ky

**Row Level Security (RLS):**
```sql
-- All tables have RLS enabled
ALTER TABLE registry_rows ENABLE ROW LEVEL SECURITY;

-- Anonymous read access for public data
CREATE POLICY "Allow anonymous read" ON registry_rows
  FOR SELECT TO anon USING (true);

-- Service role has full access (Edge Functions)
-- Anon role has read-only access (Frontend)
```

**API Key Security:**
- All API keys stored in `app_settings` table
- Edge Functions use service_role key (server-side only)
- Frontend never sees API keys
- Keys transmitted over HTTPS only

**Data Privacy:**
- All data is public court records
- No personal user data collected
- No authentication or user tracking

**CORS Configuration:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
```

---

## 5. Configuration Reference

### 5.1 Environment Variables

**Frontend (.env file)**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Yes | None | Supabase project URL (https://xxx.supabase.co) |
| `VITE_SUPABASE_ANON_KEY` | Yes | None | Supabase anonymous public key |

**Backend (Supabase Environment Variables)**

Auto-provided by Supabase to Edge Functions:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL (same as frontend) |
| `SUPABASE_ANON_KEY` | Anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full access) |

### 5.2 Database Configuration (app_settings table)

Single row with ID: `00000000-0000-0000-0000-000000000001`

**OCR Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `ocr_provider` | text | 'pdfrest' | 'pdfrest', 'convertapi' | OCR service to use |
| `ocr_api_key` | text | NULL | Any string | API key for OCR provider |

**Web Scraping Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `firecrawl_api_key` | text | NULL | fc-xxxxx | Firecrawl API key |
| `firecrawl_enabled` | boolean | false | true/false | Enable automated scraping |
| `lookback_days` | integer | 7 | 1-90 | How many days back to scrape |

**LLM Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `openai_api_key` | text | NULL | sk-xxxxx | OpenAI API key for chunking |
| `anthropic_api_key` | text | NULL | sk-ant-xxxxx | Anthropic API key for consolidation |

**Automation Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `automation_enabled` | boolean | true | true/false | Enable daily automation |
| `registry_schedule_time` | text | '07:00' | HH:MM | Daily scrape time |
| `timezone` | text | 'America/Cayman' | IANA timezone | Timezone for schedules |

**Notification Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `notification_enabled` | boolean | true | true/false | Enable notifications |
| `alert_email` | text | NULL | email@example.com | Email for alerts |
| `slack_webhook` | text | NULL | https://hooks.slack.com/... | Slack webhook URL |
| `show_only_new` | boolean | true | true/false | Filter new items only |

**Gazette Settings:**

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `gazette_regular_schedule` | text | 'biweekly_monday_0900' | cron-like | Regular gazette schedule |
| `gazette_extraordinary_schedule` | text | 'weekly_friday_0905' | cron-like | Extraordinary gazette schedule |

**Last Run Timestamps:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `last_registry_run` | timestamptz | NULL | Last successful registry scrape |
| `last_gazette_regular_run` | timestamptz | NULL | Last regular gazette scrape |
| `last_gazette_extraordinary_run` | timestamptz | NULL | Last extraordinary gazette scrape |

### 5.3 Default Values and Acceptable Ranges

**lookback_days:**
- Minimum: 1
- Maximum: 90
- Recommended: 7-14
- Impact: More days = more API calls, longer processing

**registry_schedule_time:**
- Format: HH:MM (24-hour)
- Valid: 00:00 - 23:59
- Recommended: 07:00 (after court website updates)
- Timezone: Controlled by `timezone` field

**extraction_quality_score:**
- Range: 0-100
- < 60: Requires review
- 60-79: Medium quality
- 80+: High quality

**Cost Estimates:**

Firecrawl:
- Per scrape: 1 credit
- Free tier: 500 credits/month
- Daily automation: ~30 credits/month

OpenAI (gpt-4o-mini):
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- Per 10-page PDF: ~5,000 tokens = $0.00075-$0.003

Anthropic (Claude Sonnet 4):
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens
- Per consolidation: ~2,000 tokens = $0.006-$0.03

OCR (if needed):
- PDFRest: Variable pricing
- ConvertAPI: ~$0.01-$0.05 per page

### 5.4 Configuration Examples

**Development Environment:**
```sql
UPDATE app_settings SET
  firecrawl_enabled = false,  -- Manual testing only
  automation_enabled = false,  -- No cron jobs
  lookback_days = 3,           -- Recent data only
  notification_enabled = false -- No email/Slack
WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Production Environment:**
```sql
UPDATE app_settings SET
  firecrawl_enabled = true,
  firecrawl_api_key = 'fc-prod-xxxxx',
  automation_enabled = true,
  registry_schedule_time = '07:00',
  lookback_days = 7,
  notification_enabled = true,
  alert_email = 'alerts@company.com',
  openai_api_key = 'sk-prod-xxxxx',
  anthropic_api_key = 'sk-ant-prod-xxxxx'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Testing Environment:**
```sql
UPDATE app_settings SET
  firecrawl_enabled = true,
  firecrawl_api_key = 'fc-test-xxxxx',
  automation_enabled = false,  -- Manual triggers only
  lookback_days = 1,           -- Minimal data
  notification_enabled = false,
  openai_api_key = 'sk-test-xxxxx',
  anthropic_api_key = 'sk-ant-test-xxxxx'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

---

## 6. Operational Guide

### 6.1 Starting and Stopping the Application

**Development Mode:**

```bash
# Start development server
npm run dev

# Server runs on http://localhost:5173
# Hot reload enabled - changes auto-refresh
# Press Ctrl+C to stop
```

**Production Build:**

```bash
# Create optimized build
npm run build

# Output: dist/ folder with static files
# Deploy dist/ to any static host:
# - Vercel: vercel deploy
# - Netlify: netlify deploy
# - AWS S3: aws s3 sync dist/ s3://bucket-name
```

**Backend (Supabase):**
- Edge Functions: Always running, serverless
- Database: Always online, managed by Supabase
- pg_cron: Runs automatically per schedule
- No manual start/stop required

### 6.2 Monitoring and Logging

**Frontend Logging:**

Browser DevTools Console shows:
- Supabase connection status
- API call results
- Real-time subscription events
- Component lifecycle events

**Edge Function Logging:**

View in Supabase Dashboard:
1. Go to Edge Functions
2. Select function
3. Click "Logs" tab
4. See real-time execution logs

**Query Logs:**

```sql
-- Recent scrape jobs
SELECT * FROM scrape_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Failed jobs
SELECT * FROM scrape_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Test runs
SELECT * FROM scraper_test_runs
ORDER BY started_at DESC
LIMIT 5;

-- Recent notifications
SELECT * FROM notifications
WHERE read_at IS NULL
ORDER BY created_at DESC;
```

**System Health Checks:**

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Row counts
SELECT
  'registry_rows' AS table_name, COUNT(*) AS row_count FROM registry_rows
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'gazette_issues', COUNT(*) FROM gazette_issues
UNION ALL
SELECT 'scrape_jobs', COUNT(*) FROM scrape_jobs;
```

### 6.3 Backup and Recovery

**Database Backup:**

Supabase provides automatic daily backups (retained 7 days on free tier).

Manual backup:
```sql
-- Export all data as SQL
-- Use Supabase Dashboard → Database → Backups
-- Or pg_dump via CLI:
pg_dump -h db.xxx.supabase.co -U postgres -F c -b -v -f backup.dump
```

**Restore from Backup:**
```sql
-- Via Supabase Dashboard → Database → Backups → Restore
-- Or pg_restore:
pg_restore -h db.xxx.supabase.co -U postgres -d postgres backup.dump
```

**Critical Data to Backup:**
- app_settings table (API keys)
- registry_rows table (case records)
- cases table (PDF bytes and analysis)
- analyzed_registry_pdfs table (AI summaries)

**Recovery Scenarios:**

1. **Lost API Keys:**
   - Check app_settings table: `SELECT * FROM app_settings;`
   - Re-enter in Settings page if missing

2. **Corrupted Case Data:**
   - Delete from cases table: `DELETE FROM cases WHERE id = 'xxx';`
   - Re-upload PDF and re-analyze

3. **Failed Migration:**
   - Migrations are idempotent (use IF NOT EXISTS)
   - Safe to re-run any migration
   - Check applied migrations: `SELECT * FROM supabase_migrations.schema_migrations;`

### 6.4 Performance Tuning

**Database Indexes:**

Already created by migrations:
```sql
-- Check existing indexes
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Add custom indexes if needed:
```sql
-- Index on cause_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_registry_rows_cause_number
ON registry_rows(cause_number);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_registry_rows_status
ON registry_rows(status);

-- Index on filing_date for sorting
CREATE INDEX IF NOT EXISTS idx_registry_rows_filing_date
ON registry_rows(filing_date DESC);
```

**Query Optimization:**

Use `.explain()` in Supabase:
```typescript
const { data, error, explain } = await supabase
  .from('registry_rows')
  .select('*')
  .eq('status', 'awaiting_pdf')
  .explain();
```

**Caching Strategy:**

- Frontend: React Query or SWR for client-side caching
- Database: Materialized views for complex aggregations
- Edge Functions: Cache API responses where appropriate

**Connection Pooling:**

Supabase handles automatically via pgBouncer.

**Suggested Limits:**

- Max lookback_days: 30 (reduces Firecrawl load)
- Max chunk_size: 6000 chars (balances context vs. cost)
- Max PDF size: 10 MB (prevents timeout)
- Max concurrent analyses: 5 (prevents API rate limits)

### 6.5 Troubleshooting Common Issues

See `TROUBLESHOOTING_MANUAL.md` for comprehensive guide.

**Quick Fixes:**

| Issue | Symptom | Fix |
|-------|---------|-----|
| Frontend won't load | Blank page | Check browser console, verify .env file |
| Scraping returns 0 results | No new cases found | Verify Firecrawl key, check lookback_days |
| PDF upload fails | Error message | Check PDF size < 10MB, valid PDF format |
| Analysis incomplete | Missing sections | Check LLM API keys, verify token limits |
| Dark mode not working | Theme doesn't persist | Clear localStorage, check ThemeContext |

---

## 7. Development Information

### 7.1 Code Structure and Organization

```
caymanmyass/
│
├── src/                          # Frontend source code
│   ├── main.tsx                  # Entry point, renders App
│   ├── App.tsx                   # Root component, routing setup
│   ├── index.css                 # Global styles, Tailwind imports
│   │
│   ├── pages/                    # Page components (routes)
│   │   ├── Dashboard.tsx         # Main dashboard with stats
│   │   ├── Registry.tsx          # Registry cases table
│   │   ├── Gazettes.tsx          # Gazette issues list
│   │   ├── Notices.tsx           # Gazette notices list
│   │   ├── Settings.tsx          # Configuration page
│   │   └── ReviewQueue.tsx       # Flagged items review
│   │
│   ├── components/               # Reusable UI components
│   │   ├── Layout.tsx            # Shared layout with nav
│   │   ├── DarkModeToggle.tsx    # Theme switcher
│   │   ├── CaseSummaryRenderer.tsx     # Markdown renderer
│   │   ├── RegistryAnalyzerPanel.tsx   # PDF upload form
│   │   ├── AnalyzedPdfsSection.tsx     # Analyzed PDFs list
│   │   ├── AnalyzedGazettesSection.tsx # Analyzed gazettes
│   │   ├── GazetteAnalyzerPanel.tsx    # Gazette upload
│   │   ├── PdfExtractPanel.tsx         # Legacy component
│   │   ├── ScraperTestPanel.tsx        # Test runner UI
│   │   └── DashboardSummaryDisplay.tsx # Stats widget
│   │
│   ├── contexts/                 # React Context providers
│   │   └── ThemeContext.tsx      # Dark/light mode state
│   │
│   └── lib/                      # Utilities and types
│       ├── supabase.ts           # Supabase client setup
│       └── database.types.ts     # TypeScript types for DB
│
├── supabase/                     # Backend code
│   ├── migrations/               # Database schema changes
│   │   ├── 20251010104006_create_cayman_watch_schema.sql
│   │   ├── 20251010112616_add_firecrawl_api_key.sql
│   │   ├── ... (20+ migration files in chronological order)
│   │   └── 20251016045701_remove_pdf_bytes_from_analyzed.sql
│   │
│   └── functions/                # Supabase Edge Functions
│       ├── scrape-registry/
│       │   └── index.ts          # Main scraping logic
│       ├── extract-pdf-text/
│       │   ├── index.ts          # PDF text extraction
│       │   └── extraction-patterns.ts  # Pattern matching
│       ├── analyze-case/
│       │   └── index.ts          # AI analysis orchestration
│       ├── analyze-pdf-with-claude/
│       │   └── index.ts          # Direct PDF analysis
│       ├── analyze-gazette-with-claude/
│       │   └── index.ts          # Gazette analysis
│       ├── capture-pdf/
│       │   └── index.ts          # Legacy PDF capture
│       ├── parse-gazette/
│       │   └── index.ts          # Gazette parsing
│       ├── scrape-gazette/
│       │   └── index.ts          # Gazette scraping
│       ├── send-notification/
│       │   └── index.ts          # Notification service
│       ├── test-scraper/
│       │   └── index.ts          # Test runner backend
│       └── shared/
│           └── extraction-patterns.ts  # Shared utilities
│
├── public/                       # Static assets
├── dist/                         # Production build (generated)
├── node_modules/                 # Dependencies (generated)
│
├── index.html                    # HTML template
├── package.json                  # Dependencies and scripts
├── package-lock.json             # Locked dependency versions
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.app.json             # App-specific TS config
├── tsconfig.node.json            # Node-specific TS config
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── eslint.config.js              # ESLint configuration
├── .env                          # Environment variables (not in Git)
├── .gitignore                    # Git ignore rules
│
├── README.md                     # Project name only
├── SYSTEM_STATUS.md              # Operational status report
├── QUICK_START.md                # 5-minute setup guide
├── TESTING_GUIDE.md              # Testing documentation
├── API_CONFIGURATION_GUIDE.md    # API setup instructions
├── AUTOMATION_SETUP.md           # Automation configuration
├── IMPLEMENTATION_SUMMARY.md     # Feature summary
├── UPLOAD_TROUBLESHOOTING.md     # PDF upload debugging
│
└── Documentation files (these):
    ├── MASTER_DOCUMENTATION.md   # This file
    ├── DATABASE_SCHEMA.md        # Database reference
    ├── EDGE_FUNCTIONS_API.md     # API specifications
    ├── DEPLOYMENT_GUIDE.md       # Deployment steps
    └── TROUBLESHOOTING_MANUAL.md # Problem solving
```

### 7.2 Key Algorithms and Business Logic

**Deduplication Algorithm (Fingerprinting):**

Located in: `supabase/functions/scrape-registry/index.ts`

```typescript
function generateFingerprint(entry: ParsedRegistryEntry): string {
  // Combines key fields to create unique identifier
  const data = `${entry.causeNumber}|${entry.filingDate}|${entry.title}|${entry.subject}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;  // hash * 31 + char
    hash = hash & hash;  // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);  // Base-36 encoding
}
```

**Purpose:** Prevents duplicate entries when scraping returns same cases.

**Text Chunking Algorithm:**

Located in: `supabase/functions/analyze-case/index.ts`

```typescript
function chunkText(text: string, chunkSize: number): string[] {
  // Clean excessive whitespace
  const cleanedText = text.replace(/\s+\n/g, '\n').trim();
  const chunks: string[] = [];

  // Simple fixed-size chunking
  for (let i = 0; i < cleanedText.length; i += chunkSize) {
    chunks.push(cleanedText.slice(i, i + chunkSize));
  }

  return chunks;
}
```

**Parameters:**
- chunkSize: 6000 characters (fits comfortably in GPT-4 context)
- Preserves sentence boundaries where possible
- Each chunk analyzed independently

**OCR Trigger Logic:**

Located in: `supabase/functions/extract-pdf-text/index.ts`

```typescript
function shouldTriggerOCR(extractedText: string, threshold: number): boolean {
  const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;
  return wordCount < threshold;  // Default threshold: 50 words
}
```

**Rationale:**
- Native PDF text extraction very fast, OCR slow and costly
- If extraction yields < 50 words, likely image-based PDF
- OCR only triggered when necessary

**Date Parsing Logic:**

Located in: `supabase/functions/scrape-registry/index.ts`

```typescript
function parseDateString(dateStr: string | null): string | null {
  if (!dateStr) return null;

  try {
    // Pattern 1: "15 Jan 2024"
    const ddMmmYyyy = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|...)\s+(\d{4})/i);
    if (ddMmmYyyy) {
      const [, day, month, year] = ddMmmYyyy;
      const monthNum = monthMap[month.toLowerCase()];
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;  // ISO 8601
    }

    // Pattern 2: "15/01/2024" or "15-01-2024"
    const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (parts) {
      const [, day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Pattern 3: Already ISO format
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return dateStr;

  } catch (e) {
    console.error('Date parsing error:', e);
  }

  return null;
}
```

**Lookback Filter:**

```typescript
function isWithinLastNDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return true;  // Include if no date

  try {
    const caseDate = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - caseDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  } catch (e) {
    return true;  // Include on error (safe default)
  }
}
```

**Quality Score Calculation:**

Located in: `supabase/functions/analyze-case/index.ts`

```typescript
// Simplified calculation
const extractedFields = Object.keys(parsedData).filter(
  k => parsedData[k] && parsedData[k] !== 'N/A'
);
const qualityScore = Math.min(100, (extractedFields.length / 5) * 100);

// 5 = number of required sections
// Score >= 80: High quality
// Score 60-79: Medium quality
// Score < 60: Requires review
```

### 7.3 Development Environment Setup

**Prerequisites:**
- Node.js v18+ installed
- VS Code (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense

**Setup Steps:**

1. Clone and install:
   ```bash
   git clone https://github.com/marchebantum/caymanmyass.git
   cd caymanmyass
   npm install
   ```

2. Create `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173

**Hot Reload:**
- Changes to `src/` auto-refresh browser
- Changes to Edge Functions require manual redeploy
- Changes to migrations require manual execution

**TypeScript:**
- Strict mode enabled
- Type checking: `npm run typecheck`
- Errors shown in VS Code inline

### 7.4 Testing Procedures

**Manual Testing Workflow:**

1. **Scraper Test:**
   - Go to Settings page
   - Scroll to "Scraper Testing & Diagnostics"
   - Select "Dry Run" mode
   - Click "Run Scraper Test"
   - Verify all steps show green checkmarks

2. **PDF Upload Test:**
   - Download sample PDF from judicial.ky
   - Go to Registry page
   - Click "Upload PDF" in analyzer panel
   - Select cause number
   - Upload PDF
   - Wait for processing (10-30 seconds)
   - Verify status changes to "analyzed"
   - Click "View Analysis" and inspect results

3. **Dashboard Test:**
   - Go to Dashboard
   - Click "Check for New Cases"
   - Wait for completion
   - Verify notification appears if new cases found
   - Check stats update correctly

**Automated Test Script:**

Located in: `test-workflow.mjs`

```bash
node test-workflow.mjs
```

Tests:
- Database connectivity
- Edge function availability
- App settings existence
- Table access

**Manual Test Cases:**

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Theme toggle | Click moon/sun icon | Dark/light mode switches |
| Navigation | Click all nav links | All pages load without errors |
| Search | Type in Registry search | Results filter correctly |
| Real-time updates | Open 2 browser tabs, upload PDF in one | Other tab updates automatically |
| Error handling | Upload invalid file | Error message displayed |

**Database Testing:**

```sql
-- Test RLS policies
SET ROLE anon;  -- Simulate frontend
SELECT * FROM registry_rows LIMIT 1;  -- Should work
INSERT INTO registry_rows (...) VALUES (...);  -- Should fail
RESET ROLE;

-- Test triggers
UPDATE registry_rows SET status='analyzed' WHERE cause_number='TEST-001';
-- Verify updated_at changed

-- Test Edge Function calls
SELECT net.http_post(
  url := 'https://xxx.supabase.co/functions/v1/scrape-registry',
  headers := '{"Authorization": "Bearer xxx"}'::jsonb
);
```

### 7.5 Deployment Process

**Frontend Deployment:**

**Option 1: Vercel (Recommended)**

```bash
npm install -g vercel
vercel login
vercel deploy

# Production deployment
vercel --prod
```

**Option 2: Netlify**

```bash
npm install -g netlify-cli
netlify login
netlify deploy

# Production deployment
netlify deploy --prod
```

**Option 3: Static Hosting (AWS S3, Cloudflare Pages, etc.)**

```bash
npm run build
# Upload dist/ folder to hosting provider
```

**Environment Variables on Host:**
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in hosting dashboard
- Vercel: Settings → Environment Variables
- Netlify: Site settings → Build & deploy → Environment

**Backend Deployment:**

Edge Functions:
- Deploy via Supabase CLI (see Installation Guide)
- Or manually copy-paste in Supabase Dashboard

Database Migrations:
- Run sequentially in SQL Editor
- Or use `supabase db push` with CLI

**Deployment Checklist:**

- [ ] All migrations applied to production database
- [ ] All Edge Functions deployed and tested
- [ ] app_settings configured with production API keys
- [ ] Frontend environment variables set on hosting platform
- [ ] Frontend build succeeds without errors
- [ ] DNS configured (if custom domain)
- [ ] HTTPS enabled (automatic with modern hosts)
- [ ] Test all major flows in production
- [ ] Monitor logs for errors
- [ ] Set up monitoring/alerting (optional)

**Rollback Procedure:**

Frontend:
- Redeploy previous version via hosting dashboard
- Or: `git revert` and redeploy

Backend:
- Database: Restore from Supabase backup
- Edge Functions: Redeploy previous version

**Zero-Downtime Deployment:**

- Frontend: Hosting providers handle automatically
- Backend: Supabase Edge Functions deployed with blue-green strategy (automatic)
- Database: Use transactions for migrations, test in staging first

---

## Appendices

### A. Glossary

- **Cause Number:** Unique identifier for court cases (e.g., FSD-123/2024)
- **Registry Row:** Database record representing a court case entry
- **Firecrawl:** Web scraping service that handles JavaScript-heavy sites
- **Fingerprint:** Hash-based unique identifier for deduplication
- **OCR:** Optical Character Recognition, converts images to text
- **Edge Function:** Serverless function running on Supabase (Deno runtime)
- **RLS:** Row Level Security, PostgreSQL security feature
- **pg_cron:** PostgreSQL extension for scheduled jobs
- **Lookback Period:** Number of days to search backwards for new cases
- **Dashboard Summary:** AI-generated structured report from case PDFs

### B. Related Documentation Files

- **DATABASE_SCHEMA.md** - Complete database table specifications
- **EDGE_FUNCTIONS_API.md** - Detailed API endpoint documentation
- **DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions
- **TROUBLESHOOTING_MANUAL.md** - Problem-solving guide
- **QUICK_START.md** - 5-minute quickstart guide
- **TESTING_GUIDE.md** - Testing procedures and diagnostics
- **API_CONFIGURATION_GUIDE.md** - External API setup
- **SYSTEM_STATUS.md** - Current operational status

### C. External Resources

**Documentation:**
- Supabase Docs: https://supabase.com/docs
- Firecrawl Docs: https://docs.firecrawl.dev
- OpenAI API Docs: https://platform.openai.com/docs
- Anthropic API Docs: https://docs.anthropic.com
- React Docs: https://react.dev
- TypeScript Docs: https://www.typescriptlang.org/docs

**Tools:**
- Supabase Dashboard: https://app.supabase.com
- Firecrawl Dashboard: https://firecrawl.dev/app
- OpenAI Platform: https://platform.openai.com
- Anthropic Console: https://console.anthropic.com

**Support:**
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/marchebantum/caymanmyass/issues

### D. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Oct 18, 2025 | Initial comprehensive documentation |
| 0.9 | Oct 16, 2025 | System stabilization, all features working |
| 0.8 | Oct 10, 2025 | LLM integration, dual-model pipeline |
| 0.7 | Oct 10, 2025 | Automated scheduling with pg_cron |
| 0.6 | Oct 10, 2025 | Firecrawl integration |
| 0.5 | Oct 10, 2025 | PDF extraction and OCR fallback |
| 0.4 | Oct 10, 2025 | Database schema finalized |
| 0.3 | Oct 10, 2025 | Edge functions deployed |
| 0.2 | Oct 10, 2025 | Frontend UI implementation |
| 0.1 | Oct 10, 2025 | Project initialization |

---

**Document Status:** Complete
**Last Updated:** October 18, 2025
**Maintained By:** AI System Documentation Generator
**For:** Cayman Watch Application

---

*This documentation is designed to be fully comprehensible by AI systems and enables autonomous deployment, configuration, and maintenance of the Cayman Watch application.*
