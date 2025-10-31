/*
  # Enhance Gazette Liquidation Schema

  This migration enhances the gazette analysis system to support:
  - Multiple entity types (Companies, Partnerships)
  - Multiple liquidation types (Voluntary, Court-Ordered, Unknown)
  - Advanced filtering capabilities
  - Cross-referenced final meeting dates
  - Court cause numbers for court-ordered liquidations

  ## Changes to analyzed_gazette_pdfs

  1. Add summary_stats (jsonb) - stores extraction summary statistics:
     - totalEntities
     - companiesVoluntary
     - companiesCourtOrdered
     - partnershipsVoluntary
     - entitiesWithFinalMeetings

  ## Changes to gazette_liquidation_notices

  1. Add new fields for enhanced data model:
     - entity_type (text) - "Company" or "Partnership"
     - registration_no (text, nullable) - registration number with prefix
     - liquidation_type (text) - "Voluntary", "Court-Ordered", or "Unknown"
     - liquidators (jsonb array) - array of liquidator names
     - contact_emails (jsonb array) - array of email addresses
     - court_cause_no (text, nullable) - court cause number for court-ordered liquidations
     - liquidation_date (date) - date liquidation commenced
     - final_meeting_date (date, nullable) - scheduled final meeting date
     - notes (text) - additional context and information

  2. Create new indexes for filtering performance:
     - entity_type
     - liquidation_type
     - registration_no

  ## Security
  - Maintains existing RLS policies
  - No changes to access control
*/

-- Add summary_stats to analyzed_gazette_pdfs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyzed_gazette_pdfs' AND column_name = 'summary_stats'
  ) THEN
    ALTER TABLE analyzed_gazette_pdfs ADD COLUMN summary_stats jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add new columns to gazette_liquidation_notices
DO $$
BEGIN
  -- entity_type (Company or Partnership)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE gazette_liquidation_notices
    ADD COLUMN entity_type text DEFAULT 'Company'
    CHECK (entity_type IN ('Company', 'Partnership'));
  END IF;

  -- registration_no (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'registration_no'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN registration_no text;
  END IF;

  -- liquidation_type (Voluntary, Court-Ordered, Unknown)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'liquidation_type'
  ) THEN
    ALTER TABLE gazette_liquidation_notices
    ADD COLUMN liquidation_type text DEFAULT 'Voluntary'
    CHECK (liquidation_type IN ('Voluntary', 'Court-Ordered', 'Unknown'));
  END IF;

  -- liquidators (JSONB array of liquidator names)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'liquidators'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN liquidators jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- contact_emails (JSONB array of email addresses)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'contact_emails'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN contact_emails jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- court_cause_no (nullable, for court-ordered liquidations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'court_cause_no'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN court_cause_no text;
  END IF;

  -- liquidation_date (date liquidation commenced)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'liquidation_date'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN liquidation_date date;
  END IF;

  -- final_meeting_date (nullable, scheduled final meeting)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'final_meeting_date'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN final_meeting_date date;
  END IF;

  -- notes (additional context and information)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gazette_liquidation_notices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE gazette_liquidation_notices ADD COLUMN notes text;
  END IF;
END $$;

-- Create indexes for improved filtering performance
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_entity_type
  ON gazette_liquidation_notices(entity_type);

CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_liquidation_type
  ON gazette_liquidation_notices(liquidation_type);

CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_registration_no
  ON gazette_liquidation_notices(registration_no);

CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_final_meeting_date
  ON gazette_liquidation_notices(final_meeting_date DESC);

-- Create GIN index for JSONB array searches on liquidators and contact_emails
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_liquidators_gin
  ON gazette_liquidation_notices USING GIN (liquidators);

CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_contact_emails_gin
  ON gazette_liquidation_notices USING GIN (contact_emails);
