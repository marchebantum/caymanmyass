/*
  # Add LLM API Keys and Dashboard Summary Fields

  1. Changes to app_settings table
    - Add openai_api_key (text) for OpenAI API authentication
    - Add anthropic_api_key (text) for Anthropic Claude API authentication
  
  2. Changes to cases table
    - Add dashboard_summary (text) to store formatted dashboard-ready case summary
    - Add llm_tokens_used (jsonb) to track token usage and costs per case
      Structure: {openai_tokens: number, anthropic_tokens: number, total_cost: number}
  
  3. Security
    - No RLS changes needed (existing policies apply)
    - API keys stored encrypted at rest in Supabase
*/

-- Add LLM API key fields to app_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN openai_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'anthropic_api_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN anthropic_api_key text;
  END IF;
END $$;

-- Add dashboard summary and LLM tracking fields to cases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'dashboard_summary'
  ) THEN
    ALTER TABLE cases ADD COLUMN dashboard_summary text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'llm_tokens_used'
  ) THEN
    ALTER TABLE cases ADD COLUMN llm_tokens_used jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add helpful comment to explain the structure
COMMENT ON COLUMN cases.llm_tokens_used IS 'Token usage tracking: {openai_tokens: number, anthropic_tokens: number, total_cost: number, timestamp: string}';
COMMENT ON COLUMN cases.dashboard_summary IS 'Concise dashboard-ready case summary formatted for quick scanning';
COMMENT ON COLUMN app_settings.openai_api_key IS 'OpenAI API key for GPT models used in PDF chunking analysis';
COMMENT ON COLUMN app_settings.anthropic_api_key IS 'Anthropic API key for Claude models used in final consolidation';
