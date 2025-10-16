/*
  # Fix Cases Table Access for Anonymous Users

  1. Changes
    - Add SELECT policy for anon role to cases table
    - Add INSERT policy for anon role to cases table
    - Add UPDATE policy for anon role to cases table
    - This allows the frontend (using anon key) to manage cases

  2. Security
    - Anon users can read all cases
    - Anon users can insert cases (needed for PDF upload workflow)
    - Anon users can update cases (needed for processing workflow)
*/

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read cases" ON cases;
DROP POLICY IF EXISTS "Anyone can insert cases" ON cases;
DROP POLICY IF EXISTS "Anyone can update cases" ON cases;

-- Allow anon users to read cases
CREATE POLICY "Anyone can read cases"
  ON cases FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to insert cases
CREATE POLICY "Anyone can insert cases"
  ON cases FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to update cases
CREATE POLICY "Anyone can update cases"
  ON cases FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);