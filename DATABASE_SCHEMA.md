# Cayman Watch - Database Schema Documentation

**Version:** 1.0
**Last Updated:** October 18, 2025
**Database:** PostgreSQL 15+
**Extensions Required:** pg_cron

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Diagram](#schema-diagram)
3. [Table Specifications](#table-specifications)
4. [Relationships](#relationships)
5. [Indexes and Performance](#indexes-and-performance)
6. [Security and RLS Policies](#security-and-rls-policies)
7. [Triggers and Functions](#triggers-and-functions)
8. [Data Types and Enums](#data-types-and-enums)
9. [Query Examples](#query-examples)
10. [Maintenance and Optimization](#maintenance-and-optimization)

---

## Overview

The Cayman Watch database consists of **14 tables** organized into functional groups:

### Core Data Tables
- `registry_rows` - Court case entries from judicial.ky
- `cases` - Analyzed case data with PDFs
- `gazette_issues` - Government gazette publications
- `gazette_notices` - Individual liquidation appointments

### Analysis and Processing Tables
- `analyzed_registry_pdfs` - AI-analyzed registry documents
- `analyzed_gazette_pdfs` - AI-analyzed gazette documents
- `gazette_liquidation_notices` - Extracted gazette notices

### System Management Tables
- `app_settings` - Application configuration (singleton)
- `scrape_jobs` - Scraping job execution records
- `scraper_test_runs` - Test execution records
- `scraper_test_logs` - Detailed test logs
- `notifications` - User notifications

### Audit and Review Tables
- `review_queue` - Items flagged for manual review
- `audit_log` - Complete audit trail

**Total Storage Estimate:**
- Base schema: ~5 MB
- Per 1000 cases with PDFs: ~2-5 GB
- Per 100 gazette issues: ~500 MB - 1 GB

---

## Schema Diagram

### Entity Relationship Diagram (Textual)

```
┌──────────────────┐         ┌──────────────────┐
│  registry_rows   │ 1     0..1│      cases       │
│==================│◄──────────│==================│
│ PK: id           │           │ PK: id           │
│ UK: cause_number │           │ FK: registry_row │
│ UK: fingerprint  │           │     _id (unique) │
│                  │           │                  │
│ - cause_number   │           │ - pdf_bytes      │
│ - filing_date    │           │ - pdf_text       │
│ - status         │           │ - parsed_json    │
│ - subject        │           │ - analysis_md    │
│ - row_fingerprint│           │ - dashboard_summ │
└──────────────────┘           └──────────────────┘
                                        │
                                        │ 0..1
                                        ▼
                               ┌──────────────────┐
                               │  review_queue    │
                               │==================│
                               │ PK: id           │
                               │ - item_type      │
                               │ - item_id        │
                               │ - reason         │
                               │ - priority       │
                               └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ gazette_issues   │ 1     * │ gazette_notices  │
│==================│◄────────┤==================│
│ PK: id           │         │ PK: id           │
│ UK: run_fingerpr │         │ FK: issue_id     │
│                  │         │ UK: notice_finge │
│ - kind           │         │                  │
│ - issue_number   │         │ - company_name   │
│ - issue_date     │         │ - appointment_   │
│ - pdf_bytes      │         │   type           │
│ - pdf_text       │         │ - liquidators    │
└──────────────────┘         │ - appointment_   │
                             │   date           │
                             └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  scrape_jobs     │ *     1 │  app_settings    │
│==================│────────►│==================│
│ PK: id           │         │ PK: id (fixed)   │
│                  │         │ id='00000000...  │
│ - job_type       │         │      000001'     │
│ - started_at     │         │                  │
│ - completed_at   │         │ - api_keys       │
│ - status         │         │ - schedules      │
│ - items_found    │         │ - last_runs      │
│ - new_items      │         │ - lookback_days  │
└──────────────────┘         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ scraper_test_runs│ 1     * │ scraper_test_logs│
│==================│◄────────│==================│
│ PK: id           │         │ PK: id           │
│                  │         │ FK: test_run_id  │
│ - test_mode      │         │                  │
│ - started_at     │         │ - step           │
│ - status         │         │ - step_number    │
│ - total_steps    │         │ - status         │
└──────────────────┘         │ - message        │
                             │ - execution_time │
                             └──────────────────┘

┌──────────────────┐
│  notifications   │
│==================│
│ PK: id           │
│                  │
│ - notification_  │
│   type           │
│ - title          │
│ - message        │
│ - data (jsonb)   │
│ - sent_at        │
│ - read_at        │
│ - priority       │
└──────────────────┘

┌─────────────────────────┐
│  analyzed_registry_pdfs │
│=========================│
│ PK: id                  │
│                         │
│ - cause_number          │
│ - dashboard_summary     │
│ - extraction_metadata   │
│ - llm_tokens_used       │
└─────────────────────────┘

┌──────────────────────────┐    ┌────────────────────────────┐
│  analyzed_gazette_pdfs   │ 1 *│ gazette_liquidation_notices│
│==========================│◄───│============================│
│ PK: id                   │    │ PK: id                     │
│                          │    │ FK: analyzed_gazette_id    │
│ - gazette_type           │    │                            │
│ - issue_number           │    │ - company_name             │
│ - full_analysis          │    │ - appointment_type         │
│ - notices_count          │    │ - liquidator_name          │
└──────────────────────────┘    │ - liquidator_contact       │
                                 └────────────────────────────┘

┌──────────────────┐
│   audit_log      │
│==================│
│ PK: id           │
│                  │
│ - table_name     │
│ - record_id      │
│ - action         │
│ - old_values     │
│ - new_values     │
│ - user_id        │
└──────────────────┘
```

**Legend:**
- `PK` = Primary Key
- `FK` = Foreign Key
- `UK` = Unique Key/Index
- `1` = One
- `*` = Many
- `0..1` = Zero or One
- `◄─` = Relationship direction

---

## Table Specifications

### 1. registry_rows

**Purpose:** Stores court case entries scraped from judicial.ky public registers.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `scraped_at` | timestamptz | NO | now() | When row was scraped |
| `cause_number` | text | NO | - | Case identifier (e.g., "FSD-123/2024") |
| `filing_date` | date | YES | NULL | Date case was filed |
| `title` | text | YES | NULL | Case title/parties |
| `subject` | text | YES | NULL | Subject (e.g., "Winding Up-Petition") |
| `register_bucket` | text | YES | 'Financial Services' | Register category |
| `box_cdn_url` | text | YES | NULL | Ephemeral PDF download link |
| `box_url_captured_at` | timestamptz | YES | NULL | When URL was captured |
| `box_url_expired` | boolean | NO | false | Whether URL has expired |
| `source_html` | text | YES | NULL | Raw HTML for debugging |
| `row_fingerprint` | text | NO | - | Hash for deduplication (UNIQUE) |
| `status` | text | NO | 'new' | Processing status |
| `notes` | text | YES | NULL | Additional notes |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Status Values:**
- `new` - Freshly scraped, no action taken
- `awaiting_pdf` - Detected, waiting for PDF upload
- `pdf_captured` - PDF downloaded but not extracted
- `processing` - Currently being analyzed
- `analyzed` - Successfully analyzed
- `needs_manual` - Requires manual intervention
- `expired_link` - PDF URL has expired

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `row_fingerprint`
- INDEX on `scraped_at`
- INDEX on `cause_number`
- INDEX on `filing_date`
- INDEX on `subject`
- INDEX on `status`

**Constraints:**
- `cause_number` NOT NULL
- `row_fingerprint` NOT NULL, UNIQUE

**Typical Row Size:** ~500 bytes - 2 KB (depending on HTML size)

**Expected Volume:** 1000-5000 rows (cumulative over time)

---

### 2. cases

**Purpose:** Stores analyzed case data including PDFs and extracted information.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `registry_row_id` | uuid | YES | NULL | Foreign key to registry_rows (UNIQUE) |
| `pdf_url` | text | YES | NULL | URL to PDF (if available) |
| `pdf_bytes` | bytea | YES | NULL | Raw PDF file content |
| `pdf_text` | text | YES | NULL | Extracted text from PDF |
| `ocr_used` | boolean | NO | false | Whether OCR was used |
| `extraction_confidence` | text | NO | 'medium' | Extraction quality |
| `parsed_json` | jsonb | NO | '{}'::jsonb | Structured extraction result |
| `analysis_md` | text | YES | NULL | Markdown formatted analysis |
| `dashboard_summary` | text | YES | NULL | Dashboard-ready summary |
| `llm_tokens_used` | jsonb | NO | '{}'::jsonb | LLM usage tracking |
| `extraction_metadata` | jsonb | NO | '{}'::jsonb | Metadata about extraction |
| `fields_extracted` | jsonb | NO | '[]'::jsonb | List of successfully extracted fields |
| `fields_missing` | jsonb | NO | '[]'::jsonb | List of missing fields |
| `extraction_quality_score` | integer | NO | 0 | Quality score (0-100) |
| `requires_review` | boolean | NO | false | Whether manual review needed |
| `review_notes` | text | YES | NULL | Manual review notes |
| `status` | text | NO | 'processing' | Processing status |
| `error_message` | text | YES | NULL | Error details if failed |
| `processed_at` | timestamptz | YES | NULL | When analysis completed |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Status Values:**
- `processing` - Being processed
- `text_extracted` - Text extracted, awaiting analysis
- `analyzed` - Fully analyzed and ready
- `error` - Processing failed
- `waiting_pdf` - Waiting for PDF upload

**Extraction Confidence Values:**
- `high` - Native PDF text extraction, > 50 words
- `medium` - OCR used successfully
- `low` - OCR used, poor results
- `failed` - Extraction failed entirely

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `registry_row_id`
- INDEX on `status`
- INDEX on `extraction_confidence`

**Foreign Keys:**
- `registry_row_id` REFERENCES `registry_rows(id)` ON DELETE CASCADE

**Typical Row Size:** 500 KB - 5 MB (due to pdf_bytes)

**Expected Volume:** Same as registry_rows (1-to-1 or 0-to-1 relationship)

**parsed_json Structure:**
```json
{
  "parties": [
    {
      "role": "Petitioner",
      "name": "Company Name",
      "details": "Additional info",
      "registered_office_provider": "Service Provider"
    }
  ],
  "timeline": [
    {
      "date": "2024-01-15",
      "event": "Petition filed",
      "confidence": "high"
    }
  ],
  "financials": {
    "currency": "USD",
    "amounts": [
      {
        "amount": 100000,
        "currency": "USD",
        "context": "Outstanding debt"
      }
    ],
    "debt_summary": "Total debt $100,000",
    "insolvency_indicators": ["Unable to pay debts"]
  },
  "liquidators": [
    {
      "name": "John Doe",
      "firm": "Liquidation Partners",
      "appointment_type": "Official Liquidator"
    }
  ],
  "law_firm": "Legal Firm Name"
}
```

---

### 3. gazette_issues

**Purpose:** Stores gazette PDF files and parsing metadata.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `kind` | text | NO | - | 'regular' or 'extraordinary' |
| `issue_number` | text | YES | NULL | e.g., "Ga05/2025" or "Ex63/2024" |
| `issue_date` | date | YES | NULL | Publication date |
| `pdf_url` | text | YES | NULL | URL to gazette PDF |
| `pdf_bytes` | bytea | YES | NULL | Raw PDF content |
| `pdf_text` | text | YES | NULL | Extracted text |
| `ocr_used` | boolean | NO | false | Whether OCR was used |
| `parsed_count` | integer | NO | 0 | Number of notices extracted |
| `quality_score` | numeric(5,2) | YES | NULL | Parsing accuracy (0-100.00) |
| `possible_misses` | jsonb | NO | '[]'::jsonb | Array of potentially missed entries |
| `run_fingerprint` | text | NO | - | Hash for deduplication (UNIQUE) |
| `manually_reviewed` | boolean | NO | false | Whether human reviewed |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `run_fingerprint`
- INDEX on `kind`
- INDEX on `issue_date`
- INDEX on `quality_score`

**Typical Row Size:** 2 MB - 10 MB (due to PDF)

**Expected Volume:** 50-100 issues per year

**possible_misses Structure:**
```json
[
  {
    "phrase_matched": "In the Matter of",
    "company_name_candidate": "Possible Company Ltd.",
    "surrounding_text": "...context...",
    "character_position": 12345,
    "reason": "Partial match outside main section"
  }
]
```

---

### 4. gazette_notices

**Purpose:** Individual liquidation notices extracted from gazettes.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `issue_id` | uuid | YES | NULL | Foreign key to gazette_issues |
| `section` | text | NO | 'Voluntary Liquidator...' | Section name |
| `company_name` | text | NO | - | Company in liquidation |
| `appointment_type` | text | YES | NULL | Type of liquidation |
| `appointment_date` | date | YES | NULL | Date of appointment |
| `liquidators` | jsonb | NO | '[]'::jsonb | Array of liquidator details |
| `raw_block` | text | YES | NULL | Original notice text |
| `page_number` | integer | YES | NULL | Estimated page in gazette |
| `notice_fingerprint` | text | NO | - | Hash for deduplication (UNIQUE) |
| `extraction_confidence` | text | NO | 'medium' | Extraction quality |
| `manually_verified` | boolean | NO | false | Whether human verified |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `notice_fingerprint`
- INDEX on `issue_id`
- INDEX on `company_name`
- INDEX on `appointment_type`
- INDEX on `appointment_date`
- INDEX on `extraction_confidence`

**Foreign Keys:**
- `issue_id` REFERENCES `gazette_issues(id)` ON DELETE CASCADE

**liquidators Structure:**
```json
[
  {
    "name": "John Doe",
    "firm": "Liquidation Services Ltd.",
    "phones": ["+1-345-555-0100"],
    "emails": ["john@liquidationservices.ky"],
    "address": "Grand Cayman"
  }
]
```

**Typical Row Size:** 1-5 KB

**Expected Volume:** 50-200 notices per gazette issue

---

### 5. scrape_jobs

**Purpose:** Tracks all scraping job executions (scheduled and manual).

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `job_type` | text | NO | - | Type of job |
| `scheduled_at` | timestamptz | YES | NULL | Scheduled start time |
| `started_at` | timestamptz | YES | NULL | Actual start time |
| `completed_at` | timestamptz | YES | NULL | Completion time |
| `status` | text | NO | 'pending' | Job status |
| `items_found` | integer | NO | 0 | Total items discovered |
| `new_items` | integer | NO | 0 | New items since last run |
| `quality_metrics` | jsonb | NO | '{}'::jsonb | Performance metrics |
| `error_log` | text | YES | NULL | Error details if failed |
| `summary_report` | text | YES | NULL | Human-readable summary |
| `triggered_by` | text | NO | 'scheduled' | Who/what triggered the job |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**job_type Values:**
- `registry_daily` - Daily registry scraping
- `gazette_regular` - Regular gazette scraping
- `gazette_extraordinary` - Extraordinary gazette scraping

**status Values:**
- `pending` - Scheduled but not started
- `running` - Currently executing
- `success` - Completed successfully
- `failed` - Failed with errors
- `partial_success` - Completed with warnings

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `job_type`
- INDEX on `status`
- INDEX on `created_at`

**Typical Row Size:** 1-10 KB

**Expected Volume:** ~365 jobs per year (daily automation)

**quality_metrics Structure:**
```json
{
  "total_entries_parsed": 150,
  "recent_entries": 25,
  "lookback_days": 7,
  "rejected_entries": 2,
  "new_entries": 3,
  "monitoring_mode": "firecrawl",
  "scrape_metadata": {
    "html_length": 125000,
    "tr_count": 180,
    "td_count": 900
  }
}
```

---

### 6. app_settings

**Purpose:** Application configuration and preferences (singleton table).

**Singleton ID:** `00000000-0000-0000-0000-000000000001`

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | - | Primary key (fixed value) |
| `ocr_provider` | text | NO | 'pdfrest' | OCR service ('pdfrest' or 'convertapi') |
| `ocr_api_key` | text | YES | NULL | OCR API key |
| `firecrawl_api_key` | text | YES | NULL | Firecrawl API key |
| `firecrawl_enabled` | boolean | NO | false | Enable Firecrawl scraping |
| `automation_enabled` | boolean | NO | true | Enable daily automation |
| `alert_email` | text | YES | NULL | Email for notifications |
| `slack_webhook` | text | YES | NULL | Slack webhook URL |
| `show_only_new` | boolean | NO | true | Filter to new items only |
| `registry_schedule_time` | text | NO | '07:00' | Daily scrape time (HH:MM) |
| `gazette_regular_schedule` | text | NO | 'biweekly_monday_0900' | Regular gazette schedule |
| `gazette_extraordinary_schedule` | text | NO | 'weekly_friday_0905' | Extraordinary gazette schedule |
| `timezone` | text | NO | 'America/Cayman' | IANA timezone |
| `last_registry_run` | timestamptz | YES | NULL | Last successful registry scrape |
| `last_gazette_regular_run` | timestamptz | YES | NULL | Last regular gazette scrape |
| `last_gazette_extraordinary_run` | timestamptz | YES | NULL | Last extraordinary gazette scrape |
| `notification_enabled` | boolean | NO | true | Enable notifications |
| `lookback_days` | integer | NO | 7 | How many days back to search |
| `openai_api_key` | text | YES | NULL | OpenAI API key |
| `anthropic_api_key` | text | YES | NULL | Anthropic API key |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`

**Access:**
- Always use `WHERE id = '00000000-0000-0000-0000-000000000001'`
- Should contain exactly 1 row

**Typical Row Size:** < 1 KB

---

### 7. review_queue

**Purpose:** Items flagged for manual review due to low quality/confidence.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `item_type` | text | NO | - | Type of item ('case', 'gazette_notice', etc.) |
| `item_id` | uuid | NO | - | References the flagged item |
| `reason` | text | NO | - | Why it was flagged |
| `priority` | text | NO | 'medium' | Review priority |
| `reviewed` | boolean | NO | false | Whether reviewed |
| `reviewed_by` | text | YES | NULL | User who reviewed |
| `reviewed_at` | timestamptz | YES | NULL | When reviewed |
| `notes` | text | YES | NULL | Review notes |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**priority Values:**
- `high` - Urgent review needed
- `medium` - Standard review
- `low` - Can be deferred

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `item_type`
- INDEX on `reviewed`
- INDEX on `priority`
- INDEX on `created_at`

**Typical Row Size:** < 1 KB

---

### 8. audit_log

**Purpose:** Complete audit trail of sensitive operations.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `table_name` | text | NO | - | Affected table |
| `record_id` | uuid | YES | NULL | Affected record ID |
| `action` | text | NO | - | Action taken ('insert', 'update', 'delete') |
| `old_values` | jsonb | YES | NULL | Before state |
| `new_values` | jsonb | YES | NULL | After state |
| `user_id` | text | YES | NULL | User who made change |
| `created_at` | timestamptz | NO | now() | Timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `table_name`
- INDEX on `record_id`
- INDEX on `created_at`

**Typical Row Size:** 1-10 KB (depending on values)

**Retention:** Consider archiving records older than 1 year

---

### 9. notifications

**Purpose:** User notifications displayed on dashboard.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `notification_type` | text | NO | - | Type of notification |
| `title` | text | NO | - | Notification title |
| `message` | text | NO | - | Notification message |
| `data` | jsonb | NO | '{}'::jsonb | Additional data |
| `channels` | jsonb | NO | '[]'::jsonb | Delivery channels |
| `sent_at` | timestamptz | NO | now() | When sent |
| `read_at` | timestamptz | YES | NULL | When read by user |
| `priority` | text | NO | 'medium' | Notification priority |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**notification_type Values:**
- `new_cases` - New registry cases detected
- `scrape_complete` - Scraping job finished
- `analysis_complete` - Case analysis finished
- `system_alert` - System issues or warnings

**priority Values:**
- `critical` - Immediate attention required
- `high` - Important
- `medium` - Standard
- `low` - Informational

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `read_at` (for filtering unread)
- INDEX on `created_at`

**data Structure (for new_cases):**
```json
{
  "cause_numbers": ["FSD-123/2024", "FSD-124/2024"],
  "count": 2,
  "lookback_days": 7
}
```

---

### 10. scraper_test_runs

**Purpose:** Tracks test executions from the test panel.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `test_mode` | text | NO | 'dry_run' | Test mode |
| `started_at` | timestamptz | NO | now() | Start time |
| `completed_at` | timestamptz | YES | NULL | Completion time |
| `status` | text | NO | 'running' | Test status |
| `total_steps` | integer | NO | 0 | Total test steps |
| `successful_steps` | integer | NO | 0 | Successful steps |
| `failed_steps` | integer | NO | 0 | Failed steps |
| `total_entries_found` | integer | NO | 0 | Total entries found |
| `total_execution_time_ms` | integer | NO | 0 | Total execution time |
| `summary` | text | YES | NULL | Test summary |
| `triggered_by` | text | NO | 'manual_test' | Who triggered |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**test_mode Values:**
- `dry_run` - Don't save to database
- `live` - Save results to database

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `started_at`

---

### 11. scraper_test_logs

**Purpose:** Detailed step-by-step logs for test runs.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `test_run_id` | uuid | NO | - | Foreign key to scraper_test_runs |
| `timestamp` | timestamptz | NO | now() | Log timestamp |
| `step` | text | NO | - | Step name |
| `step_number` | integer | NO | - | Step sequence |
| `status` | text | NO | - | Step status |
| `message` | text | NO | - | Step message |
| `data` | jsonb | NO | '{}'::jsonb | Step data |
| `error_message` | text | YES | NULL | Error if failed |
| `execution_time_ms` | integer | NO | 0 | Step execution time |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**status Values:**
- `success` - Step succeeded
- `warning` - Step succeeded with warnings
- `error` - Step failed
- `info` - Informational

**Foreign Keys:**
- `test_run_id` REFERENCES `scraper_test_runs(id)` ON DELETE CASCADE

---

### 12. analyzed_registry_pdfs

**Purpose:** Stores AI-analyzed registry PDFs uploaded directly.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `cause_number` | text | NO | - | Case identifier |
| `dashboard_summary` | text | NO | - | AI-generated summary |
| `extraction_metadata` | jsonb | NO | '{}'::jsonb | Extraction metadata |
| `extraction_quality_score` | integer | NO | 0 | Quality score (0-100) |
| `llm_tokens_used` | jsonb | NO | '{}'::jsonb | Token usage tracking |
| `uploaded_by` | text | NO | 'system' | Who uploaded |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `cause_number`

**Note:** Does NOT store pdf_bytes (too large, increases cost)

---

### 13. analyzed_gazette_pdfs

**Purpose:** Stores AI-analyzed gazette PDFs.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `gazette_type` | text | NO | - | 'regular' or 'extraordinary' |
| `issue_number` | text | YES | NULL | Gazette issue number |
| `issue_date` | date | YES | NULL | Publication date |
| `full_analysis` | text | NO | - | Complete AI analysis |
| `notices_count` | integer | NO | 0 | Number of notices extracted |
| `extraction_metadata` | jsonb | NO | '{}'::jsonb | Extraction metadata |
| `llm_tokens_used` | jsonb | NO | '{}'::jsonb | Token usage tracking |
| `uploaded_by` | text | NO | 'system' | Who uploaded |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `gazette_type`
- INDEX on `issue_date`

---

### 14. gazette_liquidation_notices

**Purpose:** Individual notices extracted from analyzed gazettes.

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `analyzed_gazette_id` | uuid | NO | - | Foreign key to analyzed_gazette_pdfs |
| `company_name` | text | NO | - | Company name |
| `appointment_type` | text | NO | - | Type of appointment |
| `appointment_date` | date | YES | NULL | Date of appointment |
| `liquidator_name` | text | YES | NULL | Liquidator name |
| `liquidator_contact` | text | YES | NULL | Contact information |
| `raw_notice_text` | text | YES | NULL | Original notice text |
| `extraction_confidence` | text | NO | 'medium' | Extraction quality |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `analyzed_gazette_id` REFERENCES `analyzed_gazette_pdfs(id)` ON DELETE CASCADE

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `analyzed_gazette_id`
- INDEX on `company_name`
- INDEX on `appointment_date`

---

## Relationships

### Primary Relationships

1. **registry_rows ↔ cases (1:0..1)**
   - One registry row can have zero or one case
   - `cases.registry_row_id` references `registry_rows.id`
   - CASCADE DELETE: Deleting registry_row deletes associated case

2. **gazette_issues ↔ gazette_notices (1:many)**
   - One gazette issue contains many notices
   - `gazette_notices.issue_id` references `gazette_issues.id`
   - CASCADE DELETE: Deleting issue deletes all its notices

3. **scraper_test_runs ↔ scraper_test_logs (1:many)**
   - One test run has many log entries
   - `scraper_test_logs.test_run_id` references `scraper_test_runs.id`
   - CASCADE DELETE: Deleting test run deletes all logs

4. **analyzed_gazette_pdfs ↔ gazette_liquidation_notices (1:many)**
   - One analyzed gazette contains many notices
   - `gazette_liquidation_notices.analyzed_gazette_id` references `analyzed_gazette_pdfs.id`
   - CASCADE DELETE: Deleting analyzed gazette deletes extracted notices

### Soft Relationships (via IDs, no FK)

5. **review_queue → multiple tables**
   - `item_id` can reference any table based on `item_type`
   - No foreign key constraint (polymorphic)

6. **audit_log → multiple tables**
   - `record_id` references various tables based on `table_name`
   - No foreign key constraint (audit flexibility)

---

## Indexes and Performance

### Index Strategy

**Primary Keys:**
All tables have UUID primary keys with default B-tree index.

**Unique Constraints:**
- `registry_rows.row_fingerprint` - Prevents duplicate scrapes
- `registry_rows.cause_number` - Logical uniqueness
- `cases.registry_row_id` - One case per registry row
- `gazette_issues.run_fingerprint` - Prevents duplicate gazette imports
- `gazette_notices.notice_fingerprint` - Prevents duplicate notices

**Date/Time Indexes:**
- Essential for queries filtering by date ranges
- All `created_at`, `scraped_at`, `filing_date`, `issue_date` columns indexed

**Status Indexes:**
- Critical for filtering by processing state
- `status` columns on most tables

**Text Search:**
Consider adding GIN indexes for full-text search:
```sql
CREATE INDEX idx_registry_rows_title_gin ON registry_rows USING gin(to_tsvector('english', title));
CREATE INDEX idx_cases_pdf_text_gin ON cases USING gin(to_tsvector('english', pdf_text));
```

### Query Performance Tips

1. **Use indexes effectively:**
   ```sql
   -- Good: Uses index
   SELECT * FROM registry_rows WHERE status = 'awaiting_pdf';

   -- Bad: Doesn't use index
   SELECT * FROM registry_rows WHERE LOWER(status) = 'awaiting_pdf';
   ```

2. **Limit result sets:**
   ```sql
   -- Always use LIMIT for large tables
   SELECT * FROM cases ORDER BY created_at DESC LIMIT 100;
   ```

3. **Use covering indexes:**
   ```sql
   -- Index includes all selected columns
   CREATE INDEX idx_registry_rows_status_cause ON registry_rows(status, cause_number);
   SELECT cause_number FROM registry_rows WHERE status = 'analyzed';
   ```

4. **Analyze query plans:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM cases WHERE status = 'analyzed';
   ```

---

## Security and RLS Policies

### Row Level Security (RLS)

All tables have RLS enabled. Policies allow:

**Authenticated Users:**
- SELECT on all tables
- INSERT on data tables
- UPDATE on data tables
- DELETE restrictions (most tables don't allow DELETE via policies)

**Anonymous Users (anon role):**
- SELECT only on public data tables:
  - `registry_rows`
  - `cases`
  - `gazette_issues`
  - `gazette_notices`
  - `scrape_jobs`
  - `notifications`
  - `analyzed_registry_pdfs`
  - `analyzed_gazette_pdfs`
  - `gazette_liquidation_notices`

- NO ACCESS to:
  - `app_settings` (contains API keys)
  - `audit_log` (sensitive)
  - `review_queue` (internal)

**Service Role:**
- Full access to all tables (used by Edge Functions)
- Bypasses RLS policies

### Example Policies

```sql
-- Anonymous read access to registry_rows
CREATE POLICY "Allow anonymous read registry_rows"
  ON registry_rows FOR SELECT
  TO anon
  USING (true);

-- Authenticated users can update registry_rows
CREATE POLICY "Authenticated users can update registry_rows"
  ON registry_rows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only authenticated can read app_settings
CREATE POLICY "Authenticated users can read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);
```

### Security Best Practices

1. **Never expose service_role key to frontend**
2. **Always use HTTPS for API calls**
3. **Rotate API keys regularly**
4. **Monitor audit_log for suspicious activity**
5. **Validate input on Edge Functions before database operations**

---

## Triggers and Functions

### Auto-update Triggers

**Function:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Triggers Applied To:**
- `registry_rows`
- `cases`
- `gazette_issues`
- `gazette_notices`
- `app_settings`
- `analyzed_registry_pdfs`
- `analyzed_gazette_pdfs`
- `gazette_liquidation_notices`

**Behavior:**
Automatically updates `updated_at` timestamp on every UPDATE operation.

### Custom Functions

None currently implemented, but consider:

1. **Cleanup old notifications:**
   ```sql
   CREATE FUNCTION cleanup_old_notifications() RETURNS void AS $$
     DELETE FROM notifications
     WHERE read_at IS NOT NULL
     AND read_at < now() - interval '30 days';
   $$ LANGUAGE sql;
   ```

2. **Archive old audit logs:**
   ```sql
   CREATE FUNCTION archive_audit_logs() RETURNS void AS $$
     INSERT INTO audit_log_archive SELECT * FROM audit_log
     WHERE created_at < now() - interval '1 year';
     DELETE FROM audit_log WHERE created_at < now() - interval '1 year';
   $$ LANGUAGE sql;
   ```

---

## Data Types and Enums

### Custom Enums

While enum types are defined in migrations, they're not strictly enforced (using text instead for flexibility):

**Defined Enums (for reference):**
- `job_status`: 'pending', 'running', 'success', 'failed', 'partial_success'
- `job_type`: 'registry_daily', 'gazette_regular', 'gazette_extraordinary'
- `gazette_kind`: 'regular', 'extraordinary'
- `confidence_level`: 'high', 'medium', 'low'
- `priority_level`: 'high', 'medium', 'low'

**Actual Implementation:**
Using `text` columns for flexibility, but following enum conventions.

### JSONB Usage

**Benefits:**
- Flexible schema for varying data structures
- Indexable with GIN indexes
- Queryable with JSON operators

**Tables Using JSONB:**
- `cases.parsed_json` - Structured case data
- `cases.llm_tokens_used` - Token tracking
- `cases.extraction_metadata` - Extraction details
- `cases.fields_extracted` - Extracted fields array
- `cases.fields_missing` - Missing fields array
- `gazette_issues.possible_misses` - Missed entries
- `gazette_notices.liquidators` - Liquidator details
- `scrape_jobs.quality_metrics` - Job metrics
- `notifications.data` - Notification payload
- All metadata and configuration fields

**JSONB Query Examples:**
```sql
-- Query nested JSON
SELECT * FROM cases
WHERE parsed_json->'financials'->>'currency' = 'USD';

-- Check array contains
SELECT * FROM cases
WHERE fields_extracted ? 'company_name';

-- Array length
SELECT COUNT(*) FROM gazette_notices
WHERE jsonb_array_length(liquidators) > 1;
```

---

## Query Examples

### Common Queries

**1. Get all awaiting PDF cases:**
```sql
SELECT
  rr.cause_number,
  rr.filing_date,
  rr.title,
  rr.subject,
  rr.status
FROM registry_rows rr
WHERE rr.status = 'awaiting_pdf'
ORDER BY rr.filing_date DESC;
```

**2. Get analyzed cases with details:**
```sql
SELECT
  rr.cause_number,
  rr.filing_date,
  c.dashboard_summary,
  c.extraction_quality_score,
  c.processed_at
FROM registry_rows rr
JOIN cases c ON c.registry_row_id = rr.id
WHERE rr.status = 'analyzed'
ORDER BY c.processed_at DESC
LIMIT 10;
```

**3. Get recent scrape jobs:**
```sql
SELECT
  job_type,
  started_at,
  completed_at,
  status,
  items_found,
  new_items,
  summary_report
FROM scrape_jobs
WHERE job_type = 'registry_daily'
ORDER BY started_at DESC
LIMIT 5;
```

**4. Get unread notifications:**
```sql
SELECT
  notification_type,
  title,
  message,
  priority,
  sent_at
FROM notifications
WHERE read_at IS NULL
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  sent_at DESC;
```

**5. Get gazette notices by company:**
```sql
SELECT
  gi.issue_number,
  gi.issue_date,
  gn.company_name,
  gn.appointment_type,
  gn.appointment_date,
  gn.liquidators
FROM gazette_notices gn
JOIN gazette_issues gi ON gi.id = gn.issue_id
WHERE gn.company_name ILIKE '%Company Name%'
ORDER BY gi.issue_date DESC;
```

**6. Get cases requiring review:**
```sql
SELECT
  rr.cause_number,
  c.extraction_quality_score,
  c.extraction_confidence,
  rq.reason,
  rq.priority
FROM review_queue rq
JOIN cases c ON c.id = rq.item_id::uuid
JOIN registry_rows rr ON rr.id = c.registry_row_id
WHERE rq.item_type = 'case'
  AND rq.reviewed = false
ORDER BY rq.priority, rq.created_at;
```

**7. Calculate scraping statistics:**
```sql
SELECT
  COUNT(*) as total_cases,
  COUNT(*) FILTER (WHERE status = 'awaiting_pdf') as awaiting_pdf,
  COUNT(*) FILTER (WHERE status = 'analyzed') as analyzed,
  MIN(filing_date) as earliest_case,
  MAX(filing_date) as latest_case
FROM registry_rows;
```

**8. Get LLM cost summary:**
```sql
SELECT
  COUNT(*) as cases_analyzed,
  SUM((llm_tokens_used->>'openai_tokens')::int) as total_openai_tokens,
  SUM((llm_tokens_used->>'anthropic_tokens')::int) as total_anthropic_tokens,
  SUM((llm_tokens_used->>'total_cost')::numeric) as total_cost
FROM cases
WHERE llm_tokens_used IS NOT NULL
  AND llm_tokens_used != '{}'::jsonb;
```

---

## Maintenance and Optimization

### Regular Maintenance Tasks

**1. Vacuum and Analyze:**
```sql
-- Run weekly
VACUUM ANALYZE registry_rows;
VACUUM ANALYZE cases;
VACUUM ANALYZE gazette_issues;
VACUUM ANALYZE scrape_jobs;
```

**2. Reindex:**
```sql
-- Run monthly or after bulk operations
REINDEX TABLE registry_rows;
REINDEX TABLE cases;
```

**3. Update Statistics:**
```sql
ANALYZE registry_rows;
ANALYZE cases;
```

### Data Cleanup

**1. Archive old scrape jobs:**
```sql
DELETE FROM scrape_jobs
WHERE created_at < now() - interval '90 days'
  AND status IN ('success', 'failed');
```

**2. Clear old notifications:**
```sql
DELETE FROM notifications
WHERE read_at IS NOT NULL
  AND read_at < now() - interval '30 days';
```

**3. Remove orphaned review queue items:**
```sql
DELETE FROM review_queue
WHERE reviewed = true
  AND reviewed_at < now() - interval '90 days';
```

### Monitoring Queries

**1. Table sizes:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**2. Index usage:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**3. Slow queries:**
```sql
SELECT
  query,
  calls,
  total_time / 1000 as total_seconds,
  mean_time / 1000 as mean_seconds
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_%'
ORDER BY total_time DESC
LIMIT 20;
```

**4. Database connections:**
```sql
SELECT
  datname,
  COUNT(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

### Backup Strategy

**Supabase Automatic Backups:**
- Daily backups retained for 7 days (free tier)
- Point-in-time recovery available (paid tiers)

**Manual Backup:**
```bash
pg_dump -h db.xxx.supabase.co \
  -U postgres \
  -F c \
  -b \
  -v \
  -f cayman_watch_backup_$(date +%Y%m%d).dump \
  postgres
```

**Selective Backup (config only):**
```sql
COPY (SELECT * FROM app_settings) TO '/tmp/app_settings_backup.csv' CSV HEADER;
```

### Performance Optimization

**1. Add missing indexes:**
```sql
-- Identify slow queries first, then add indexes
CREATE INDEX CONCURRENTLY idx_custom ON table_name(column);
```

**2. Partition large tables:**
```sql
-- If registry_rows grows > 100k rows, consider partitioning by year
-- (Advanced topic, consult PostgreSQL documentation)
```

**3. Use materialized views for complex queries:**
```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'awaiting_pdf') as awaiting_pdf,
  COUNT(*) FILTER (WHERE status = 'analyzed') as analyzed,
  COUNT(*) as total
FROM registry_rows;

-- Refresh periodically
REFRESH MATERIALIZED VIEW dashboard_stats;
```

---

## Appendix: Migration History

| Migration File | Date | Description |
|----------------|------|-------------|
| `20251010104006_create_cayman_watch_schema.sql` | Oct 10, 2025 | Initial schema creation |
| `20251010112616_add_firecrawl_api_key.sql` | Oct 10, 2025 | Add Firecrawl configuration |
| `20251010113757_enable_pg_cron_and_scheduling.sql` | Oct 10, 2025 | Enable automated scheduling |
| `20251010120000_add_scraper_test_logs.sql` | Oct 10, 2025 | Add test logging tables |
| `20251010131626_add_lookback_days_to_settings.sql` | Oct 10, 2025 | Add lookback_days field |
| `20251010135316_fix_registry_rows_anon_access.sql` | Oct 10, 2025 | Fix RLS for anonymous users |
| `20251010135335_fix_cases_anon_access.sql` | Oct 10, 2025 | Fix RLS for cases |
| `20251010135349_fix_dashboard_tables_anon_access.sql` | Oct 10, 2025 | Fix RLS for dashboard tables |
| `20251010140519_add_extraction_metadata_fields.sql` | Oct 10, 2025 | Add extraction tracking fields |
| `20251010144933_add_llm_api_keys_and_dashboard_fields.sql` | Oct 10, 2025 | Add LLM configuration |
| `20251010150000_create_analyzed_pdfs_tables.sql` | Oct 10, 2025 | Add analyzed PDF tables |
| `20251010164059_remove_pdf_bytes_from_analyzed_tables.sql` | Oct 10, 2025 | Optimize storage |

---

**Document Status:** Complete
**Last Updated:** October 18, 2025
**Total Tables:** 14
**Total Indexes:** 60+
**Total Triggers:** 8

*This database schema documentation is designed to be fully comprehensible by AI systems and provides complete specifications for all tables, relationships, and operations.*
