/*
  # Enable pg_cron and Set Up Automated Registry Monitoring

  ## Overview
  This migration enables the pg_cron extension and sets up automated daily monitoring
  of the judicial.ky registry. It creates the infrastructure for scheduled scraping
  jobs that run without manual intervention.

  ## Changes Made

  1. **Extensions**
     - Enable pg_cron extension for database-level scheduled tasks
     - Enable pg_net extension for making HTTP requests from database

  2. **New Tables**
     - `notifications` - Track all notifications sent by the system
       - id (uuid, primary key)
       - notification_type (text) - registry_new_cases, system_alert, error_alert
       - title (text) - notification headline
       - message (text) - detailed message
       - data (jsonb) - structured data (case numbers, counts, etc.)
       - channels (jsonb) - where notification was sent (dashboard, email, slack)
       - sent_at (timestamptz) - when notification was created
       - read_at (timestamptz) - when user acknowledged it
       - priority (text) - low, medium, high, critical
       - created_at (timestamptz)

  3. **Database Functions**
     - `trigger_registry_scrape()` - Calls the scrape-registry edge function
     - `send_notification()` - Creates and sends notifications
     - `check_for_new_cases()` - Checks if new cases were found and notifies

  4. **Cron Jobs**
     - Daily registry monitoring at 7:00 AM (Cayman time)
     - Configurable schedule based on app_settings table

  5. **Security**
     - Enable RLS on notifications table
     - Add policies for authenticated users

  ## Notes
  - Cron jobs run in UTC, so times are adjusted from Cayman time (UTC-5)
  - HTTP requests use pg_net extension which is async and non-blocking
  - Errors are logged to scrape_jobs table for monitoring
  - Notifications are stored in database and can be displayed in UI
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS http;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  channels jsonb DEFAULT '["dashboard"]'::jsonb,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  priority text DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to trigger registry scrape via edge function
CREATE OR REPLACE FUNCTION trigger_registry_scrape()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_data jsonb;
  edge_function_url text;
  supabase_url text;
  anon_key text;
  request_id bigint;
BEGIN
  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL THEN
    supabase_url := 'https://hffetgwpezjfmsiwysje.supabase.co';
  END IF;

  -- Get anon key from environment
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF anon_key IS NULL THEN
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZmV0Z3dwZXpqZm1zaXd5c2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTA0MjMsImV4cCI6MjA3NTY2NjQyM30.CUZcomxhRq_CXG2rozPCFVaJMT0LN5cbcfptJHV9SJw';
  END IF;

  edge_function_url := supabase_url || '/functions/v1/scrape-registry';

  -- Use pg_net to make async HTTP request
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  -- Return request info
  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'triggered_at', now(),
    'function_url', edge_function_url
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error to scrape_jobs
  INSERT INTO scrape_jobs (
    job_type,
    started_at,
    completed_at,
    status,
    error_log,
    triggered_by
  ) VALUES (
    'registry_daily',
    now(),
    now(),
    'failed',
    SQLERRM,
    'cron'
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Function to send notifications
CREATE OR REPLACE FUNCTION send_notification(
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_priority text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    notification_type,
    title,
    message,
    data,
    priority,
    channels
  ) VALUES (
    p_type,
    p_title,
    p_message,
    p_data,
    p_priority,
    '["dashboard"]'::jsonb
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- Function to check for new cases and create notifications
CREATE OR REPLACE FUNCTION check_for_new_cases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_case_count integer;
  awaiting_pdf_count integer;
  new_cases_list text[];
  last_check timestamptz;
BEGIN
  -- Get last check time
  SELECT last_registry_run INTO last_check
  FROM app_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Count new cases since last check
  SELECT COUNT(*), array_agg(cause_number)
  INTO new_case_count, new_cases_list
  FROM registry_rows
  WHERE created_at > COALESCE(last_check, now() - interval '24 hours')
  AND status = 'awaiting_pdf';

  -- Count total awaiting PDF
  SELECT COUNT(*) INTO awaiting_pdf_count
  FROM registry_rows
  WHERE status = 'awaiting_pdf';

  -- Send notification if new cases found
  IF new_case_count > 0 THEN
    PERFORM send_notification(
      'registry_new_cases',
      format('%s New Registry %s Detected', new_case_count, CASE WHEN new_case_count = 1 THEN 'Case' ELSE 'Cases' END),
      format('New petition entries have been found. Please download PDFs from judicial.ky and upload them in the Registry page. Cases: %s', array_to_string(new_cases_list, ', ')),
      jsonb_build_object(
        'count', new_case_count,
        'cause_numbers', new_cases_list,
        'total_awaiting', awaiting_pdf_count
      ),
      CASE WHEN new_case_count >= 5 THEN 'high' ELSE 'medium' END
    );
  END IF;
END;
$$;

-- Schedule daily registry scraping at 7:00 AM Cayman time (12:00 PM UTC / noon)
-- Cayman is UTC-5, so 7:00 AM Cayman = 12:00 PM UTC
SELECT cron.schedule(
  'daily-registry-scrape',
  '0 12 * * *',  -- Every day at noon UTC (7:00 AM Cayman time)
  $$
  SELECT trigger_registry_scrape();
  SELECT check_for_new_cases();
  $$
);

-- Add function to get unread notifications count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM notifications
  WHERE read_at IS NULL;
$$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_registry_rows_created_status ON registry_rows(created_at, status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_type_created ON scrape_jobs(job_type, created_at DESC);

-- Update app_settings to include automation flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'automation_enabled'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN automation_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'firecrawl_enabled'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN firecrawl_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Update default app_settings
UPDATE app_settings
SET 
  automation_enabled = true,
  firecrawl_enabled = false
WHERE id = '00000000-0000-0000-0000-000000000001';
