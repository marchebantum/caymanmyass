/*
  # Fix app_settings RLS Policies

  1. Changes
    - Drop existing authenticated-only policies
    - Add new policies that allow anon role access
    - This is needed because the app doesn't have authentication yet

  2. Security
    - Allow anon users to read and update app_settings
    - Since this is a single-user app without auth, this is acceptable
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can update app_settings" ON app_settings;

-- Create new policies for anon access
CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update app_settings"
  ON app_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);