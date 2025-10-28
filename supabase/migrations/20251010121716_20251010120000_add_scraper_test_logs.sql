/*
  # Scraper Testing Infrastructure

  1. New Tables
    - `scraper_test_logs`
      - `id` (uuid, primary key)
      - `test_run_id` (uuid, indexed) - groups logs from same test run
      - `timestamp` (timestamptz) - when this log entry was created
      - `step` (text) - which step of the test (e.g., "validate_api", "fetch_html", "parse_table")
      - `step_number` (integer) - order of execution
      - `status` (text) - success, warning, error, info
      - `message` (text) - human-readable message
      - `data` (jsonb) - structured data from this step
      - `error_message` (text) - error details if status is error
      - `execution_time_ms` (integer) - how long this step took
      - `created_at` (timestamptz)

    - `scraper_test_runs`
      - `id` (uuid, primary key)
      - `test_mode` (text) - dry_run or live
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `status` (text) - running, success, failed, partial
      - `total_steps` (integer)
      - `successful_steps` (integer)
      - `failed_steps` (integer)
      - `total_entries_found` (integer)
      - `total_execution_time_ms` (integer)
      - `summary` (text)
      - `triggered_by` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read/write
*/

-- scraper_test_runs table
CREATE TABLE IF NOT EXISTS scraper_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_mode text NOT NULL DEFAULT 'dry_run',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  total_steps integer DEFAULT 0,
  successful_steps integer DEFAULT 0,
  failed_steps integer DEFAULT 0,
  total_entries_found integer DEFAULT 0,
  total_execution_time_ms integer DEFAULT 0,
  summary text,
  triggered_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraper_test_runs_status ON scraper_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_test_runs_started_at ON scraper_test_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_scraper_test_runs_test_mode ON scraper_test_runs(test_mode);

-- scraper_test_logs table
CREATE TABLE IF NOT EXISTS scraper_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES scraper_test_runs(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  step text NOT NULL,
  step_number integer NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  execution_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraper_test_logs_test_run_id ON scraper_test_logs(test_run_id);
CREATE INDEX IF NOT EXISTS idx_scraper_test_logs_timestamp ON scraper_test_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_scraper_test_logs_status ON scraper_test_logs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_test_logs_step_number ON scraper_test_logs(step_number);

-- Enable Row Level Security
ALTER TABLE scraper_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_test_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scraper_test_runs
CREATE POLICY "Authenticated users can read scraper_test_runs"
  ON scraper_test_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scraper_test_runs"
  ON scraper_test_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scraper_test_runs"
  ON scraper_test_runs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scraper_test_runs"
  ON scraper_test_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for scraper_test_logs
CREATE POLICY "Authenticated users can read scraper_test_logs"
  ON scraper_test_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scraper_test_logs"
  ON scraper_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can manage scraper_test_logs"
  ON scraper_test_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);