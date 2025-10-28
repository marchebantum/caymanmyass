/*
  # Fix Dashboard Tables Access for Anonymous Users

  1. Changes
    - Add SELECT policy for anon role to app_settings table
    - Add SELECT policy for anon role to notifications table
    - Add UPDATE policy for anon role to notifications table (for marking as read)
    - Add SELECT policy for anon role to gazette_notices table
    - This allows the dashboard to display stats and notifications

  2. Security
    - Anon users can read app_settings (needed for job status)
    - Anon users can read notifications
    - Anon users can update notifications (to mark as read)
    - Anon users can read gazette_notices (for stats)
*/

-- app_settings policies
DROP POLICY IF EXISTS "Anyone can read app_settings" ON app_settings;
CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  TO anon
  USING (true);

-- notifications policies
DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON notifications;

CREATE POLICY "Anyone can read notifications"
  ON notifications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update notifications"
  ON notifications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- gazette_notices policies
DROP POLICY IF EXISTS "Anyone can read gazette_notices" ON gazette_notices;
CREATE POLICY "Anyone can read gazette_notices"
  ON gazette_notices FOR SELECT
  TO anon
  USING (true);