/*
  # Create Analyzed PDFs Tables

  This migration creates tables for storing analyzed PDFs separately from the registry and gazette workflows.

  ## New Tables

  ### analyzed_registry_pdfs
  Stores registry case PDF analyses independently from registry_rows.
  This table serves as a repository of all analyzed registry PDFs.
  - id (uuid, primary key)
  - cause_number (text, indexed) - reference to the case for linking
  - pdf_bytes (bytea) - raw PDF file
  - dashboard_summary (text) - AI-generated dashboard summary
  - extraction_metadata (jsonb) - metadata about the extraction
  - extraction_quality_score (numeric) - quality score 0-100
  - llm_tokens_used (jsonb) - token usage information
  - uploaded_by (text) - user identifier
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### analyzed_gazette_pdfs
  Stores gazette PDF analyses for both regular and extraordinary gazettes.
  - id (uuid, primary key)
  - gazette_type (text) - 'regular' or 'extraordinary'
  - issue_number (text) - e.g., Ga05/2025 or Ex63/2024
  - issue_date (date, indexed) - publication date
  - pdf_bytes (bytea) - raw PDF file
  - full_analysis (text) - complete AI analysis
  - notices_count (integer) - number of liquidation notices extracted
  - extraction_metadata (jsonb) - metadata about the extraction
  - llm_tokens_used (jsonb) - token usage information
  - uploaded_by (text) - user identifier
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### gazette_liquidation_notices
  Stores individual company liquidation notices extracted from gazette PDFs.
  Only includes notices from "Voluntary Liquidator and Creditor Notices" section.
  - id (uuid, primary key)
  - analyzed_gazette_id (uuid, foreign key to analyzed_gazette_pdfs)
  - company_name (text, indexed) - company in liquidation
  - appointment_type (text, indexed) - voluntary liquidation, official liquidation, receivership, etc.
  - appointment_date (date, indexed) - date of appointment
  - liquidator_name (text) - name of liquidator/receiver
  - liquidator_contact (text) - contact details (phone, email, address)
  - raw_notice_text (text) - original notice text from PDF
  - extraction_confidence (text) - high, medium, low
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for anonymous access (since this is a monitoring system)
*/

-- Create analyzed_registry_pdfs table
CREATE TABLE IF NOT EXISTS analyzed_registry_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_number text NOT NULL,
  pdf_bytes bytea NOT NULL,
  dashboard_summary text NOT NULL,
  extraction_metadata jsonb DEFAULT '{}'::jsonb,
  extraction_quality_score numeric DEFAULT 0,
  llm_tokens_used jsonb DEFAULT '{}'::jsonb,
  uploaded_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for analyzed_registry_pdfs
CREATE INDEX IF NOT EXISTS idx_analyzed_registry_pdfs_cause_number ON analyzed_registry_pdfs(cause_number);
CREATE INDEX IF NOT EXISTS idx_analyzed_registry_pdfs_created_at ON analyzed_registry_pdfs(created_at DESC);

-- Create analyzed_gazette_pdfs table
CREATE TABLE IF NOT EXISTS analyzed_gazette_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gazette_type text NOT NULL CHECK (gazette_type IN ('regular', 'extraordinary')),
  issue_number text,
  issue_date date,
  pdf_bytes bytea NOT NULL,
  full_analysis text NOT NULL,
  notices_count integer DEFAULT 0,
  extraction_metadata jsonb DEFAULT '{}'::jsonb,
  llm_tokens_used jsonb DEFAULT '{}'::jsonb,
  uploaded_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for analyzed_gazette_pdfs
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_type ON analyzed_gazette_pdfs(gazette_type);
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_issue_date ON analyzed_gazette_pdfs(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_created_at ON analyzed_gazette_pdfs(created_at DESC);

-- Create gazette_liquidation_notices table
CREATE TABLE IF NOT EXISTS gazette_liquidation_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzed_gazette_id uuid NOT NULL REFERENCES analyzed_gazette_pdfs(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  appointment_type text NOT NULL,
  appointment_date date,
  liquidator_name text,
  liquidator_contact text,
  raw_notice_text text,
  extraction_confidence text DEFAULT 'medium' CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for gazette_liquidation_notices
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_gazette_id ON gazette_liquidation_notices(analyzed_gazette_id);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_company_name ON gazette_liquidation_notices(company_name);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_appointment_type ON gazette_liquidation_notices(appointment_type);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_appointment_date ON gazette_liquidation_notices(appointment_date DESC);

-- Enable Row Level Security
ALTER TABLE analyzed_registry_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzed_gazette_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gazette_liquidation_notices ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (monitoring system needs public read access)
CREATE POLICY "Allow anonymous read access to analyzed_registry_pdfs"
  ON analyzed_registry_pdfs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to analyzed_registry_pdfs"
  ON analyzed_registry_pdfs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete to analyzed_registry_pdfs"
  ON analyzed_registry_pdfs FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read access to analyzed_gazette_pdfs"
  ON analyzed_gazette_pdfs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to analyzed_gazette_pdfs"
  ON analyzed_gazette_pdfs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete to analyzed_gazette_pdfs"
  ON analyzed_gazette_pdfs FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read access to gazette_liquidation_notices"
  ON gazette_liquidation_notices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to gazette_liquidation_notices"
  ON gazette_liquidation_notices FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete to gazette_liquidation_notices"
  ON gazette_liquidation_notices FOR DELETE
  TO anon
  USING (true);