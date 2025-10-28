/*
  # Remove PDF Storage from Analyzed Tables

  This migration removes the pdf_bytes column from analyzed_registry_pdfs and analyzed_gazette_pdfs tables.
  
  ## Changes
  
  1. Drop pdf_bytes column from analyzed_registry_pdfs
     - System should only store analysis output, not the actual PDF files
     - This dramatically reduces database storage requirements
     - Improves query performance by eliminating large binary data transfers
  
  2. Drop pdf_bytes column from analyzed_gazette_pdfs
     - Same reasoning as above
     - PDFs are analyzed via Edge Functions, only text results are stored
  
  ## Impact
  
  - Existing records will lose PDF data (which is intended behavior)
  - Database size will be significantly reduced
  - Query performance will improve dramatically
  - No breaking changes to application logic since PDFs are not used after analysis
*/

-- Drop pdf_bytes from analyzed_registry_pdfs
ALTER TABLE analyzed_registry_pdfs DROP COLUMN IF EXISTS pdf_bytes;

-- Drop pdf_bytes from analyzed_gazette_pdfs
ALTER TABLE analyzed_gazette_pdfs DROP COLUMN IF EXISTS pdf_bytes;