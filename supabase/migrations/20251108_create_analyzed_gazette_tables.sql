-- Create analyzed_gazette_pdfs table
CREATE TABLE IF NOT EXISTS analyzed_gazette_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gazette_type text NOT NULL CHECK (gazette_type IN ('regular', 'extraordinary')),
  issue_number text,
  issue_date date,
  pdf_bytes bytea NOT NULL,
  full_analysis text NOT NULL,
  notices_count integer DEFAULT 0,
  extraction_metadata jsonb DEFAULT '{}'::jsonb,
  llm_tokens_used jsonb DEFAULT '{}'::jsonb,
  uploaded_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for analyzed_gazette_pdfs
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_type ON analyzed_gazette_pdfs(gazette_type);
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_issue_date ON analyzed_gazette_pdfs(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_analyzed_gazette_pdfs_created_at ON analyzed_gazette_pdfs(created_at DESC);

-- Create gazette_liquidation_notices table
CREATE TABLE IF NOT EXISTS gazette_liquidation_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzed_gazette_id uuid NOT NULL REFERENCES analyzed_gazette_pdfs(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  entity_type text DEFAULT 'Company' CHECK (entity_type IN ('Company', 'Partnership', 'Individual')),
  registration_no text,
  liquidation_type text DEFAULT 'Voluntary' CHECK (liquidation_type IN ('Voluntary', 'Court-Ordered', 'Unknown', 'Bankruptcy', 'Receivership', 'Dividend Distribution')),
  liquidators jsonb DEFAULT '[]'::jsonb,
  contact_emails jsonb DEFAULT '[]'::jsonb,
  court_cause_no text,
  liquidation_date date,
  final_meeting_date date,
  notes text,
  appointment_type text NOT NULL,
  appointment_date date,
  liquidator_name text,
  liquidator_contact text,
  raw_notice_text text,
  extraction_confidence text DEFAULT 'medium' CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for gazette_liquidation_notices
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_gazette_id ON gazette_liquidation_notices(analyzed_gazette_id);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_company_name ON gazette_liquidation_notices(company_name);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_entity_type ON gazette_liquidation_notices(entity_type);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_liquidation_type ON gazette_liquidation_notices(liquidation_type);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_registration_no ON gazette_liquidation_notices(registration_no);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_final_meeting_date ON gazette_liquidation_notices(final_meeting_date DESC);

-- Create GIN indexes for JSONB array searches
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_liquidators_gin ON gazette_liquidation_notices USING GIN (liquidators);
CREATE INDEX IF NOT EXISTS idx_gazette_liquidation_notices_contact_emails_gin ON gazette_liquidation_notices USING GIN (contact_emails);

-- Enable RLS
ALTER TABLE analyzed_gazette_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gazette_liquidation_notices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analyzed_gazette_pdfs
CREATE POLICY "Anyone can read analyzed_gazette_pdfs" ON analyzed_gazette_pdfs FOR SELECT USING (true);
CREATE POLICY "Service role can insert analyzed_gazette_pdfs" ON analyzed_gazette_pdfs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update analyzed_gazette_pdfs" ON analyzed_gazette_pdfs FOR UPDATE USING (true);

-- RLS Policies for gazette_liquidation_notices
CREATE POLICY "Anyone can read gazette_liquidation_notices" ON gazette_liquidation_notices FOR SELECT USING (true);
CREATE POLICY "Service role can insert gazette_liquidation_notices" ON gazette_liquidation_notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update gazette_liquidation_notices" ON gazette_liquidation_notices FOR UPDATE USING (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_analyzed_gazette_pdfs_updated_at ON analyzed_gazette_pdfs;
CREATE TRIGGER update_analyzed_gazette_pdfs_updated_at
    BEFORE UPDATE ON analyzed_gazette_pdfs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gazette_liquidation_notices_updated_at ON gazette_liquidation_notices;
CREATE TRIGGER update_gazette_liquidation_notices_updated_at
    BEFORE UPDATE ON gazette_liquidation_notices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

