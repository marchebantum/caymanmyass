/*
  # Add lookback_days parameter to app_settings

  1. Changes
    - Add `lookback_days` column to `app_settings` table
    - Set default value to 7 days
    - Update existing row to have lookback_days = 7

  2. Purpose
    - Configure how many days back to look when scraping registry entries
    - Matches n8n workflow requirement to capture recent cases
    - Provides flexibility for adjusting the time window
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 'lookback_days'
  ) THEN
    ALTER TABLE app_settings 
    ADD COLUMN lookback_days integer DEFAULT 7 NOT NULL;
    
    COMMENT ON COLUMN app_settings.lookback_days IS 'Number of days to look back when scraping registry entries';
  END IF;
END $$;

UPDATE app_settings 
SET lookback_days = 7 
WHERE id = '00000000-0000-0000-0000-000000000001' AND lookback_days IS NULL;