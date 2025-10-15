/*
  # Fix Registry Rows Access for Anonymous Users

  1. Changes
    - Add SELECT policy for anon role to registry_rows table
    - Add UPDATE policy for anon role to registry_rows table
    - This allows the frontend (using anon key) to read and update registry cases

  2. Security
    - Anon users can read all registry_rows (public data from judicial.ky)
    - Anon users can update registry_rows (needed for PDF upload workflow)
*/

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read registry_rows" ON registry_rows;
DROP POLICY IF EXISTS "Anyone can update registry_rows" ON registry_rows;

-- Allow anon users to read registry_rows
CREATE POLICY "Anyone can read registry_rows"
  ON registry_rows FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to update registry_rows (for status changes during PDF upload)
CREATE POLICY "Anyone can update registry_rows"
  ON registry_rows FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);