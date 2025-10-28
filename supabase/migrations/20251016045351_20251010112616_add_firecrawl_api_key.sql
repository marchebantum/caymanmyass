/*
  # Add Firecrawl API Key to App Settings

  1. Changes
    - Add `firecrawl_api_key` column to app_settings table
    - Add `firecrawl_enabled` boolean column to app_settings table
    
  2. Notes
    - Firecrawl API key will be used for automated web scraping
    - The firecrawl_enabled flag allows users to toggle between manual and automated modes
    - Both fields are nullable to maintain backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'firecrawl_api_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN firecrawl_api_key text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'firecrawl_enabled'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN firecrawl_enabled boolean DEFAULT false;
  END IF;
END $$;