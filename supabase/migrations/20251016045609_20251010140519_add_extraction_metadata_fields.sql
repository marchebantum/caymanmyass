/*
  # Add Extraction Metadata Fields

  1. Changes to `cases` table
    - Add `extraction_metadata` (jsonb) - stores field-level confidence scores and extraction methods
    - Add `fields_extracted` (jsonb) - stores which specific fields were successfully extracted
    - Add `fields_missing` (jsonb) - stores which required fields are missing
    - Add `extraction_quality_score` (numeric) - overall extraction quality percentage
    - Add `requires_review` (boolean) - auto-flag for manual review when extraction is incomplete
    - Add `review_notes` (text) - notes from manual review process
    
  2. Purpose
    - Support targeted field extraction instead of full document processing
    - Track extraction confidence at field level for quality control
    - Enable smart review queue prioritization based on missing fields
    - Provide detailed metadata for extraction performance monitoring
*/

-- Add new columns to cases table for targeted extraction metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'extraction_metadata'
  ) THEN
    ALTER TABLE cases ADD COLUMN extraction_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'fields_extracted'
  ) THEN
    ALTER TABLE cases ADD COLUMN fields_extracted jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'fields_missing'
  ) THEN
    ALTER TABLE cases ADD COLUMN fields_missing jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'extraction_quality_score'
  ) THEN
    ALTER TABLE cases ADD COLUMN extraction_quality_score numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'requires_review'
  ) THEN
    ALTER TABLE cases ADD COLUMN requires_review boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE cases ADD COLUMN review_notes text;
  END IF;
END $$;

-- Create index for review queue queries
CREATE INDEX IF NOT EXISTS idx_cases_requires_review ON cases(requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_cases_quality_score ON cases(extraction_quality_score);

-- Add comment explaining the extraction_metadata structure
COMMENT ON COLUMN cases.extraction_metadata IS 'Field-level extraction metadata: {field_name: {confidence: "high|medium|low", method: "regex|ocr|manual", extracted_at: "timestamp"}}';
COMMENT ON COLUMN cases.fields_extracted IS 'Array of successfully extracted field names: ["parties", "timeline", "liquidators", "law_firm"]';
COMMENT ON COLUMN cases.fields_missing IS 'Array of missing required field names: ["financial_summary", "registered_office_provider"]';