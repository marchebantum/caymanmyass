export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      registry_rows: {
        Row: {
          id: string
          scraped_at: string
          cause_number: string
          filing_date: string | null
          title: string | null
          subject: string | null
          register_bucket: string | null
          box_cdn_url: string | null
          box_url_captured_at: string | null
          box_url_expired: boolean
          source_html: string | null
          row_fingerprint: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scraped_at?: string
          cause_number: string
          filing_date?: string | null
          title?: string | null
          subject?: string | null
          register_bucket?: string | null
          box_cdn_url?: string | null
          box_url_captured_at?: string | null
          box_url_expired?: boolean
          source_html?: string | null
          row_fingerprint: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scraped_at?: string
          cause_number?: string
          filing_date?: string | null
          title?: string | null
          subject?: string | null
          register_bucket?: string | null
          box_cdn_url?: string | null
          box_url_captured_at?: string | null
          box_url_expired?: boolean
          source_html?: string | null
          row_fingerprint?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          registry_row_id: string | null
          pdf_url: string | null
          pdf_bytes: Buffer | null
          pdf_text: string | null
          ocr_used: boolean
          extraction_confidence: string
          parsed_json: Json
          analysis_md: string | null
          dashboard_summary: string | null
          llm_tokens_used: Json
          extraction_metadata: Json
          fields_extracted: Json
          fields_missing: Json
          extraction_quality_score: number
          requires_review: boolean
          review_notes: string | null
          status: string
          error_message: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          registry_row_id?: string | null
          pdf_url?: string | null
          pdf_bytes?: Buffer | null
          pdf_text?: string | null
          ocr_used?: boolean
          extraction_confidence?: string
          parsed_json?: Json
          analysis_md?: string | null
          dashboard_summary?: string | null
          llm_tokens_used?: Json
          extraction_metadata?: Json
          fields_extracted?: Json
          fields_missing?: Json
          extraction_quality_score?: number
          requires_review?: boolean
          review_notes?: string | null
          status?: string
          error_message?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          registry_row_id?: string | null
          pdf_url?: string | null
          pdf_bytes?: Buffer | null
          pdf_text?: string | null
          ocr_used?: boolean
          extraction_confidence?: string
          parsed_json?: Json
          analysis_md?: string | null
          dashboard_summary?: string | null
          llm_tokens_used?: Json
          extraction_metadata?: Json
          fields_extracted?: Json
          fields_missing?: Json
          extraction_quality_score?: number
          requires_review?: boolean
          review_notes?: string | null
          status?: string
          error_message?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      gazette_issues: {
        Row: {
          id: string
          kind: string
          issue_number: string | null
          issue_date: string | null
          pdf_url: string | null
          pdf_bytes: Buffer | null
          pdf_text: string | null
          ocr_used: boolean
          parsed_count: number
          quality_score: number | null
          possible_misses: Json
          run_fingerprint: string
          manually_reviewed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          issue_number?: string | null
          issue_date?: string | null
          pdf_url?: string | null
          pdf_bytes?: Buffer | null
          pdf_text?: string | null
          ocr_used?: boolean
          parsed_count?: number
          quality_score?: number | null
          possible_misses?: Json
          run_fingerprint: string
          manually_reviewed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: string
          issue_number?: string | null
          issue_date?: string | null
          pdf_url?: string | null
          pdf_bytes?: Buffer | null
          pdf_text?: string | null
          ocr_used?: boolean
          parsed_count?: number
          quality_score?: number | null
          possible_misses?: Json
          run_fingerprint?: string
          manually_reviewed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      gazette_notices: {
        Row: {
          id: string
          issue_id: string | null
          section: string
          company_name: string
          appointment_type: string | null
          appointment_date: string | null
          liquidators: Json
          raw_block: string | null
          page_number: number | null
          notice_fingerprint: string
          extraction_confidence: string
          manually_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          issue_id?: string | null
          section?: string
          company_name: string
          appointment_type?: string | null
          appointment_date?: string | null
          liquidators?: Json
          raw_block?: string | null
          page_number?: number | null
          notice_fingerprint: string
          extraction_confidence?: string
          manually_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          issue_id?: string | null
          section?: string
          company_name?: string
          appointment_type?: string | null
          appointment_date?: string | null
          liquidators?: Json
          raw_block?: string | null
          page_number?: number | null
          notice_fingerprint?: string
          extraction_confidence?: string
          manually_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      scrape_jobs: {
        Row: {
          id: string
          job_type: string
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          status: string
          items_found: number
          new_items: number
          quality_metrics: Json
          error_log: string | null
          summary_report: string | null
          triggered_by: string
          created_at: string
        }
        Insert: {
          id?: string
          job_type: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: string
          items_found?: number
          new_items?: number
          quality_metrics?: Json
          error_log?: string | null
          summary_report?: string | null
          triggered_by?: string
          created_at?: string
        }
        Update: {
          id?: string
          job_type?: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: string
          items_found?: number
          new_items?: number
          quality_metrics?: Json
          error_log?: string | null
          summary_report?: string | null
          triggered_by?: string
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          ocr_provider: string
          ocr_api_key: string | null
          firecrawl_api_key: string | null
          firecrawl_enabled: boolean
          automation_enabled: boolean
          alert_email: string | null
          slack_webhook: string | null
          show_only_new: boolean
          registry_schedule_time: string
          gazette_regular_schedule: string
          gazette_extraordinary_schedule: string
          timezone: string
          last_registry_run: string | null
          last_gazette_regular_run: string | null
          last_gazette_extraordinary_run: string | null
          notification_enabled: boolean
          lookback_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ocr_provider?: string
          ocr_api_key?: string | null
          firecrawl_api_key?: string | null
          firecrawl_enabled?: boolean
          automation_enabled?: boolean
          alert_email?: string | null
          slack_webhook?: string | null
          show_only_new?: boolean
          registry_schedule_time?: string
          gazette_regular_schedule?: string
          gazette_extraordinary_schedule?: string
          timezone?: string
          last_registry_run?: string | null
          last_gazette_regular_run?: string | null
          last_gazette_extraordinary_run?: string | null
          notification_enabled?: boolean
          lookback_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ocr_provider?: string
          ocr_api_key?: string | null
          firecrawl_api_key?: string | null
          firecrawl_enabled?: boolean
          automation_enabled?: boolean
          alert_email?: string | null
          slack_webhook?: string | null
          show_only_new?: boolean
          registry_schedule_time?: string
          gazette_regular_schedule?: string
          gazette_extraordinary_schedule?: string
          timezone?: string
          last_registry_run?: string | null
          last_gazette_regular_run?: string | null
          last_gazette_extraordinary_run?: string | null
          notification_enabled?: boolean
          lookback_days?: number
          created_at?: string
          updated_at?: string
        }
      }
      review_queue: {
        Row: {
          id: string
          item_type: string
          item_id: string
          reason: string
          priority: string
          reviewed: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_type: string
          item_id: string
          reason: string
          priority?: string
          reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_type?: string
          item_id?: string
          reason?: string
          priority?: string
          reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      analyzed_registry_pdfs: {
        Row: {
          id: string
          cause_number: string
          dashboard_summary: string
          extraction_metadata: Json
          extraction_quality_score: number
          llm_tokens_used: Json
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cause_number: string
          dashboard_summary: string
          extraction_metadata?: Json
          extraction_quality_score?: number
          llm_tokens_used?: Json
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cause_number?: string
          dashboard_summary?: string
          extraction_metadata?: Json
          extraction_quality_score?: number
          llm_tokens_used?: Json
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      analyzed_gazette_pdfs: {
        Row: {
          id: string
          gazette_type: string
          issue_number: string | null
          issue_date: string | null
          full_analysis: string
          notices_count: number
          extraction_metadata: Json
          llm_tokens_used: Json
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gazette_type: string
          issue_number?: string | null
          issue_date?: string | null
          full_analysis: string
          notices_count?: number
          extraction_metadata?: Json
          llm_tokens_used?: Json
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gazette_type?: string
          issue_number?: string | null
          issue_date?: string | null
          full_analysis?: string
          notices_count?: number
          extraction_metadata?: Json
          llm_tokens_used?: Json
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      gazette_liquidation_notices: {
        Row: {
          id: string
          analyzed_gazette_id: string
          company_name: string
          appointment_type: string
          appointment_date: string | null
          liquidator_name: string | null
          liquidator_contact: string | null
          raw_notice_text: string | null
          extraction_confidence: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          analyzed_gazette_id: string
          company_name: string
          appointment_type: string
          appointment_date?: string | null
          liquidator_name?: string | null
          liquidator_contact?: string | null
          raw_notice_text?: string | null
          extraction_confidence?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          analyzed_gazette_id?: string
          company_name?: string
          appointment_type?: string
          appointment_date?: string | null
          liquidator_name?: string | null
          liquidator_contact?: string | null
          raw_notice_text?: string | null
          extraction_confidence?: string
          created_at?: string
          updated_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          table_name: string
          record_id: string | null
          action: string
          old_values: Json | null
          new_values: Json | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id?: string | null
          action: string
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string | null
          action?: string
          old_values?: Json | null
          new_values?: Json | null
          user_id?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          notification_type: string
          title: string
          message: string
          data: Json
          channels: Json
          sent_at: string
          read_at: string | null
          priority: string
          created_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          title: string
          message: string
          data?: Json
          channels?: Json
          sent_at?: string
          read_at?: string | null
          priority?: string
          created_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          title?: string
          message?: string
          data?: Json
          channels?: Json
          sent_at?: string
          read_at?: string | null
          priority?: string
          created_at?: string
        }
      }
      scraper_test_runs: {
        Row: {
          id: string
          test_mode: string
          started_at: string
          completed_at: string | null
          status: string
          total_steps: number
          successful_steps: number
          failed_steps: number
          total_entries_found: number
          total_execution_time_ms: number
          summary: string | null
          triggered_by: string
          created_at: string
        }
        Insert: {
          id?: string
          test_mode?: string
          started_at?: string
          completed_at?: string | null
          status?: string
          total_steps?: number
          successful_steps?: number
          failed_steps?: number
          total_entries_found?: number
          total_execution_time_ms?: number
          summary?: string | null
          triggered_by?: string
          created_at?: string
        }
        Update: {
          id?: string
          test_mode?: string
          started_at?: string
          completed_at?: string | null
          status?: string
          total_steps?: number
          successful_steps?: number
          failed_steps?: number
          total_entries_found?: number
          total_execution_time_ms?: number
          summary?: string | null
          triggered_by?: string
          created_at?: string
        }
      }
      scraper_test_logs: {
        Row: {
          id: string
          test_run_id: string
          timestamp: string
          step: string
          step_number: number
          status: string
          message: string
          data: Json
          error_message: string | null
          execution_time_ms: number
          created_at: string
        }
        Insert: {
          id?: string
          test_run_id: string
          timestamp?: string
          step: string
          step_number: number
          status: string
          message: string
          data?: Json
          error_message?: string | null
          execution_time_ms?: number
          created_at?: string
        }
        Update: {
          id?: string
          test_run_id?: string
          timestamp?: string
          step?: string
          step_number?: number
          status?: string
          message?: string
          data?: Json
          error_message?: string | null
          execution_time_ms?: number
          created_at?: string
        }
      }
    }
  }
}

export type RegistryRow = Database['public']['Tables']['registry_rows']['Row']
export type Case = Database['public']['Tables']['cases']['Row']
export type GazetteIssue = Database['public']['Tables']['gazette_issues']['Row']
export type GazetteNotice = Database['public']['Tables']['gazette_notices']['Row']
export type ScrapeJob = Database['public']['Tables']['scrape_jobs']['Row']
export type AppSettings = Database['public']['Tables']['app_settings']['Row']
export type ReviewQueueItem = Database['public']['Tables']['review_queue']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ScraperTestRun = Database['public']['Tables']['scraper_test_runs']['Row']
export type ScraperTestLog = Database['public']['Tables']['scraper_test_logs']['Row']

export interface ParsedCase {
  parties: Array<{
    role: string
    name: string
    details?: string
    registered_office_provider?: string
  }>
  timeline: Array<{
    date: string
    event: string
    confidence?: string
  }>
  financials: {
    currency?: string
    amounts: Array<{
      amount: number
      currency: string
      context: string
    }>
    debt_summary?: string
    insolvency_indicators?: string[]
  }
  liquidators: Array<{
    name: string
    firm?: string
    appointment_type?: string
  }>
  law_firm?: string
}

export interface Liquidator {
  name: string
  firm?: string
  phones?: string[]
  emails?: string[]
  address?: string
}

export interface PossibleMiss {
  phrase_matched: string
  company_name_candidate: string
  surrounding_text: string
  character_position: number
  reason: string
}

export type AnalyzedRegistryPdf = Database['public']['Tables']['analyzed_registry_pdfs']['Row']
export type AnalyzedGazettePdf = Database['public']['Tables']['analyzed_gazette_pdfs']['Row']
export type GazetteLiquidationNotice = Database['public']['Tables']['gazette_liquidation_notices']['Row']
