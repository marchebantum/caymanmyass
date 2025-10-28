/*
  # Cayman Watch - Complete Database Schema

  This migration creates the complete database schema for Cayman Watch, a legal monitoring system
  for tracking Cayman Islands judicial registers and government gazettes.

  ## New Tables

  ### registry_rows
  Stores scraped data from judicial.ky public registers
  - id (uuid, primary key)
  - scraped_at (timestamptz, indexed) - when the row was captured
  - cause_number (text, indexed) - case identifier from judicial site
  - filing_date (date, indexed) - date case was filed
  - title (text) - case title
  - subject (text, indexed) - case subject (Winding Up-Petition, Petition)
  - register_bucket (text) - should be "Financial Services"
  - box_cdn_url (text) - ephemeral Box CDN download link
  - box_url_captured_at (timestamptz) - when URL was captured
  - box_url_expired (boolean) - whether URL has expired
  - source_html (text) - raw HTML of table row for debugging
  - row_fingerprint (text, unique, indexed) - hash for deduplication
  - status (text) - new, pdf_captured, analyzed, needs_manual, expired_link, processing
  - notes (text) - additional notes
  - created_at, updated_at (timestamptz)

  ### cases
  Stores analyzed case data with extracted information
  - id (uuid, primary key)
  - registry_row_id (uuid, foreign key, unique, indexed) - links to registry_rows
  - pdf_url (text) - URL to PDF if available
  - pdf_bytes (bytea) - raw PDF file bytes
  - pdf_text (text) - extracted text from PDF
  - ocr_used (boolean) - whether OCR was needed
  - extraction_confidence (text) - high, medium, low
  - parsed_json (jsonb) - structured extraction result
  - analysis_md (text) - markdown formatted analysis
  - status (text) - ready, processing, error, waiting_pdf
  - error_message (text) - error details if failed
  - processed_at (timestamptz) - when analysis completed
  - created_at, updated_at (timestamptz)

  ### gazette_issues
  Stores gazette PDFs and parsing metadata
  - id (uuid, primary key)
  - kind (text) - regular, extraordinary
  - issue_number (text) - e.g., Ga05/2025 or Ex63/2024
  - issue_date (date, indexed) - publication date
  - pdf_url (text) - URL to gazette PDF
  - pdf_bytes (bytea) - raw PDF bytes
  - pdf_text (text) - extracted text
  - ocr_used (boolean) - whether OCR was needed
  - parsed_count (integer) - number of notices extracted
  - quality_score (numeric) - parsing accuracy percentage
  - possible_misses (jsonb) - array of potentially missed entries
  - run_fingerprint (text, unique, indexed) - hash for deduplication
  - manually_reviewed (boolean) - whether human reviewed
  - created_at, updated_at (timestamptz)

  ### gazette_notices
  Stores individual liquidation notices from gazettes
  - id (uuid, primary key)
  - issue_id (uuid, foreign key, indexed) - links to gazette_issues
  - section (text) - section name, default "Voluntary Liquidator and Creditor Notices"
  - company_name (text, indexed) - company in liquidation
  - appointment_type (text, indexed) - voluntary liquidation, official liquidation, etc.
  - appointment_date (date, indexed) - date of appointment
  - liquidators (jsonb) - array of liquidator details
  - raw_block (text) - original notice text
  - page_number (integer) - estimated page in gazette
  - notice_fingerprint (text, unique, indexed) - hash for deduplication
  - extraction_confidence (text) - high, medium, low
  - manually_verified (boolean) - whether human verified
  - created_at, updated_at (timestamptz)

  ### scrape_jobs
  Tracks scheduled and manual scraping job runs
  - id (uuid, primary key)
  - job_type (text) - registry_daily, gazette_regular, gazette_extraordinary
  - scheduled_at (timestamptz) - when job was scheduled
  - started_at (timestamptz) - when execution started
  - completed_at (timestamptz) - when execution finished
  - status (text) - pending, running, success, failed, partial_success
  - items_found (integer) - total items discovered
  - new_items (integer) - new items since last run
  - quality_metrics (jsonb) - performance and accuracy metrics
  - error_log (text) - error details if failed
  - summary_report (text) - human-readable summary
  - triggered_by (text) - scheduled or manual with user identifier
  - created_at (timestamptz)

  ### app_settings
  Application configuration and preferences
  - id (uuid, primary key)
  - ocr_provider (text) - pdfrest, convertapi
  - ocr_api_key (text) - encrypted API key
  - alert_email (text) - email for notifications
  - slack_webhook (text) - Slack webhook URL
  - show_only_new (boolean) - filter to only new items
  - registry_schedule_time (time) - daily run time
  - gazette_regular_schedule (text) - biweekly schedule
  - gazette_extraordinary_schedule (text) - weekly schedule
  - timezone (text) - IANA timezone identifier
  - last_registry_run (timestamptz) - last successful registry scrape
  - last_gazette_regular_run (timestamptz) - last regular gazette scrape
  - last_gazette_extraordinary_run (timestamptz) - last extraordinary gazette scrape
  - notification_enabled (boolean) - enable/disable notifications
  - created_at, updated_at (timestamptz)

  ### review_queue
  Items flagged for manual review
  - id (uuid, primary key)
  - item_type (text) - case, gazette_notice, gazette_issue
  - item_id (uuid) - references the flagged item
  - reason (text) - why flagged
  - priority (text) - high, medium, low
  - reviewed (boolean) - whether reviewed
  - reviewed_by (text) - user who reviewed
  - reviewed_at (timestamptz) - when reviewed
  - notes (text) - review notes
  - created_at (timestamptz)

  ### audit_log
  Audit trail for sensitive operations
  - id (uuid, primary key)
  - table_name (text) - affected table
  - record_id (uuid) - affected record
  - action (text) - insert, update, delete
  - old_values (jsonb) - before state
  - new_values (jsonb) - after state
  - user_id (text) - user who made change
  - created_at (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to read/write their data
  - Restrict settings and audit log access appropriately
*/

-- Create custom types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('pending', 'running', 'success', 'failed', 'partial_success');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type') THEN
    CREATE TYPE job_type AS ENUM ('registry_daily', 'gazette_regular', 'gazette_extraordinary');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gazette_kind') THEN
    CREATE TYPE gazette_kind AS ENUM ('regular', 'extraordinary');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confidence_level') THEN
    CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN
    CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');
  END IF;
END $$;

-- registry_rows table
CREATE TABLE IF NOT EXISTS registry_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  cause_number text NOT NULL,
  filing_date date,
  title text,
  subject text,
  register_bucket text DEFAULT 'Financial Services',
  box_cdn_url text,
  box_url_captured_at timestamptz,
  box_url_expired boolean DEFAULT false,
  source_html text,
  row_fingerprint text UNIQUE NOT NULL,
  status text DEFAULT 'new',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_rows_scraped_at ON registry_rows(scraped_at);
CREATE INDEX IF NOT EXISTS idx_registry_rows_cause_number ON registry_rows(cause_number);
CREATE INDEX IF NOT EXISTS idx_registry_rows_filing_date ON registry_rows(filing_date);
CREATE INDEX IF NOT EXISTS idx_registry_rows_subject ON registry_rows(subject);
CREATE INDEX IF NOT EXISTS idx_registry_rows_status ON registry_rows(status);
CREATE INDEX IF NOT EXISTS idx_registry_rows_fingerprint ON registry_rows(row_fingerprint);

-- cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_row_id uuid UNIQUE REFERENCES registry_rows(id) ON DELETE CASCADE,
  pdf_url text,
  pdf_bytes bytea,
  pdf_text text,
  ocr_used boolean DEFAULT false,
  extraction_confidence text DEFAULT 'medium',
  parsed_json jsonb DEFAULT '{}'::jsonb,
  analysis_md text,
  status text DEFAULT 'processing',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_registry_row_id ON cases(registry_row_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_confidence ON cases(extraction_confidence);

-- gazette_issues table
CREATE TABLE IF NOT EXISTS gazette_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  issue_number text,
  issue_date date,
  pdf_url text,
  pdf_bytes bytea,
  pdf_text text,
  ocr_used boolean DEFAULT false,
  parsed_count integer DEFAULT 0,
  quality_score numeric(5,2),
  possible_misses jsonb DEFAULT '[]'::jsonb,
  run_fingerprint text UNIQUE NOT NULL,
  manually_reviewed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gazette_issues_kind ON gazette_issues(kind);
CREATE INDEX IF NOT EXISTS idx_gazette_issues_date ON gazette_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_gazette_issues_fingerprint ON gazette_issues(run_fingerprint);
CREATE INDEX IF NOT EXISTS idx_gazette_issues_quality ON gazette_issues(quality_score);

-- gazette_notices table
CREATE TABLE IF NOT EXISTS gazette_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES gazette_issues(id) ON DELETE CASCADE,
  section text DEFAULT 'Voluntary Liquidator and Creditor Notices',
  company_name text NOT NULL,
  appointment_type text,
  appointment_date date,
  liquidators jsonb DEFAULT '[]'::jsonb,
  raw_block text,
  page_number integer,
  notice_fingerprint text UNIQUE NOT NULL,
  extraction_confidence text DEFAULT 'medium',
  manually_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gazette_notices_issue_id ON gazette_notices(issue_id);
CREATE INDEX IF NOT EXISTS idx_gazette_notices_company_name ON gazette_notices(company_name);
CREATE INDEX IF NOT EXISTS idx_gazette_notices_appointment_type ON gazette_notices(appointment_type);
CREATE INDEX IF NOT EXISTS idx_gazette_notices_appointment_date ON gazette_notices(appointment_date);
CREATE INDEX IF NOT EXISTS idx_gazette_notices_fingerprint ON gazette_notices(notice_fingerprint);
CREATE INDEX IF NOT EXISTS idx_gazette_notices_confidence ON gazette_notices(extraction_confidence);

-- scrape_jobs table
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending',
  items_found integer DEFAULT 0,
  new_items integer DEFAULT 0,
  quality_metrics jsonb DEFAULT '{}'::jsonb,
  error_log text,
  summary_report text,
  triggered_by text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_type ON scrape_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON scrape_jobs(created_at);

-- app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_provider text DEFAULT 'pdfrest',
  ocr_api_key text,
  alert_email text,
  slack_webhook text,
  show_only_new boolean DEFAULT true,
  registry_schedule_time time DEFAULT '07:00',
  gazette_regular_schedule text DEFAULT 'biweekly_monday_0900',
  gazette_extraordinary_schedule text DEFAULT 'weekly_friday_0905',
  timezone text DEFAULT 'America/Cayman',
  last_registry_run timestamptz,
  last_gazette_regular_run timestamptz,
  last_gazette_extraordinary_run timestamptz,
  notification_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO app_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- review_queue table
CREATE TABLE IF NOT EXISTS review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  reason text NOT NULL,
  priority text DEFAULT 'medium',
  reviewed boolean DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_queue_item_type ON review_queue(item_type);
CREATE INDEX IF NOT EXISTS idx_review_queue_reviewed ON review_queue(reviewed);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority);
CREATE INDEX IF NOT EXISTS idx_review_queue_created_at ON review_queue(created_at);

-- audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Enable Row Level Security
ALTER TABLE registry_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE gazette_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE gazette_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registry_rows
CREATE POLICY "Authenticated users can read registry_rows"
  ON registry_rows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert registry_rows"
  ON registry_rows FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update registry_rows"
  ON registry_rows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for cases
CREATE POLICY "Authenticated users can read cases"
  ON cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for gazette_issues
CREATE POLICY "Authenticated users can read gazette_issues"
  ON gazette_issues FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert gazette_issues"
  ON gazette_issues FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update gazette_issues"
  ON gazette_issues FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for gazette_notices
CREATE POLICY "Authenticated users can read gazette_notices"
  ON gazette_notices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert gazette_notices"
  ON gazette_notices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update gazette_notices"
  ON gazette_notices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for scrape_jobs
CREATE POLICY "Authenticated users can read scrape_jobs"
  ON scrape_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scrape_jobs"
  ON scrape_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scrape_jobs"
  ON scrape_jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for app_settings
CREATE POLICY "Authenticated users can read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update app_settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for review_queue
CREATE POLICY "Authenticated users can read review_queue"
  ON review_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert review_queue"
  ON review_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update review_queue"
  ON review_queue FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for audit_log
CREATE POLICY "Authenticated users can read audit_log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit_log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_registry_rows_updated_at') THEN
    CREATE TRIGGER update_registry_rows_updated_at
      BEFORE UPDATE ON registry_rows
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cases_updated_at') THEN
    CREATE TRIGGER update_cases_updated_at
      BEFORE UPDATE ON cases
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gazette_issues_updated_at') THEN
    CREATE TRIGGER update_gazette_issues_updated_at
      BEFORE UPDATE ON gazette_issues
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gazette_notices_updated_at') THEN
    CREATE TRIGGER update_gazette_notices_updated_at
      BEFORE UPDATE ON gazette_notices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_settings_updated_at') THEN
    CREATE TRIGGER update_app_settings_updated_at
      BEFORE UPDATE ON app_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;