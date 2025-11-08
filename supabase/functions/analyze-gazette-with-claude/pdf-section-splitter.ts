/**
 * PDF Section Splitter for Gazette Analysis
 * 
 * This module provides utilities to:
 * 1. Extract the COMMERCIAL section from gazette PDFs
 * 2. Identify subsection boundaries
 * 3. Estimate token counts
 * 4. Split large PDFs into processable chunks
 */

export interface SectionInfo {
  sectionName: string;
  startIndex: number;
  endIndex: number;
  content: string;
  estimatedTokens: number;
}

export interface CommercialSectionAnalysis {
  fullContent: string;
  estimatedTokens: number;
  subsections: SectionInfo[];
  needsBatching: boolean;
}

/**
 * Estimate tokens for a given text (rough heuristic: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Target subsection names in the order they appear in gazettes
 */
const TARGET_SUBSECTIONS = [
  "Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors",
  "Notices of Final Meeting of Shareholders",
  "Partnership Notices",
  "Bankruptcy Notices",
  "Receivership Notices",
  "Dividend Notices",
  "Grand Court Notices",
];

/**
 * Subsections that mark the end of our extraction scope
 */
const STOP_AFTER_SUBSECTIONS = [
  "Dormant Accounts Notices",
  "Notice of Special Strike",
  "Reduction of Capital",
  "Certificate of Merger Notices",
  "Transfer of Companies",
  "Struck-off List",
  "Demand Notices",
  "Regulatory Agency Notices",
  "General Commercial Notices",
];

/**
 * Extract the COMMERCIAL section from the full PDF text
 * Stops after "Grand Court Notices" or when hitting excluded sections/GOVERNMENT
 */
export function extractCommercialSection(pdfText: string): string {
  const commercialRegex = /\bCOMMERCIAL\b/i;
  const governmentRegex = /\bGOVERNMENT\b/i;
  
  const commercialMatch = pdfText.match(commercialRegex);
  if (!commercialMatch || commercialMatch.index === undefined) {
    console.warn("COMMERCIAL section not found in PDF");
    return pdfText; // Return full text if COMMERCIAL section not found
  }

  const commercialStart = commercialMatch.index;
  
  // Find where to stop extraction
  let commercialEnd = pdfText.length;
  
  // Check for GOVERNMENT section
  const governmentMatch = pdfText.slice(commercialStart).match(governmentRegex);
  if (governmentMatch && governmentMatch.index !== undefined) {
    commercialEnd = Math.min(commercialEnd, commercialStart + governmentMatch.index);
  }
  
  // Check for stop-after subsections
  for (const stopSection of STOP_AFTER_SUBSECTIONS) {
    const stopRegex = new RegExp(`\\b${escapeRegExp(stopSection)}\\b`, 'i');
    const stopMatch = pdfText.slice(commercialStart).match(stopRegex);
    if (stopMatch && stopMatch.index !== undefined) {
      commercialEnd = Math.min(commercialEnd, commercialStart + stopMatch.index);
    }
  }
  
  return pdfText.slice(commercialStart, commercialEnd);
}

/**
 * Identify subsection boundaries within the COMMERCIAL section
 */
export function identifySubsections(commercialText: string): SectionInfo[] {
  const subsections: SectionInfo[] = [];
  
  for (let i = 0; i < TARGET_SUBSECTIONS.length; i++) {
    const sectionName = TARGET_SUBSECTIONS[i];
    
    // Create flexible regex to match section headings (case-insensitive, allows slight variations)
    const sectionRegex = new RegExp(
      `\\b${escapeRegExp(sectionName)}\\b`,
      'i'
    );
    
    const match = commercialText.match(sectionRegex);
    if (!match || match.index === undefined) {
      console.log(`Subsection not found: ${sectionName}`);
      continue;
    }
    
    const startIndex = match.index;
    
    // Find end index (start of next section or end of text)
    let endIndex = commercialText.length;
    
    // Look for the next target subsection
    for (let j = i + 1; j < TARGET_SUBSECTIONS.length; j++) {
      const nextSectionRegex = new RegExp(
        `\\b${escapeRegExp(TARGET_SUBSECTIONS[j])}\\b`,
        'i'
      );
      const nextMatch = commercialText.slice(startIndex + 1).match(nextSectionRegex);
      if (nextMatch && nextMatch.index !== undefined) {
        endIndex = startIndex + 1 + nextMatch.index;
        break;
      }
    }
    
    // Also check for stop-after subsections
    for (const stopSection of STOP_AFTER_SUBSECTIONS) {
      const stopRegex = new RegExp(`\\b${escapeRegExp(stopSection)}\\b`, 'i');
      const stopMatch = commercialText.slice(startIndex + 1).match(stopRegex);
      if (stopMatch && stopMatch.index !== undefined) {
        const stopIndex = startIndex + 1 + stopMatch.index;
        endIndex = Math.min(endIndex, stopIndex);
      }
    }
    
    const content = commercialText.slice(startIndex, endIndex);
    const estimatedTokens = estimateTokens(content);
    
    subsections.push({
      sectionName,
      startIndex,
      endIndex,
      content,
      estimatedTokens,
    });
  }
  
  // Sort by start index to ensure proper order
  subsections.sort((a, b) => a.startIndex - b.startIndex);
  
  return subsections;
}

/**
 * Analyze the COMMERCIAL section and determine if batching is needed
 * @param pdfText - Full PDF text
 * @param maxInputTokens - Maximum input tokens allowed (default: 180,000 to leave room for prompt + output)
 */
export function analyzeCommercialSection(
  pdfText: string,
  maxInputTokens = 180000
): CommercialSectionAnalysis {
  const fullContent = extractCommercialSection(pdfText);
  const estimatedTokens = estimateTokens(fullContent);
  const subsections = identifySubsections(fullContent);
  const needsBatching = estimatedTokens > maxInputTokens;
  
  console.log(`COMMERCIAL section analysis:`);
  console.log(`  - Total estimated tokens: ${estimatedTokens.toLocaleString()}`);
  console.log(`  - Subsections found: ${subsections.length}`);
  console.log(`  - Needs batching: ${needsBatching}`);
  
  subsections.forEach((section, idx) => {
    console.log(`  - Section ${idx + 1}: ${section.sectionName} (~${section.estimatedTokens.toLocaleString()} tokens)`);
  });
  
  return {
    fullContent,
    estimatedTokens,
    subsections,
    needsBatching,
  };
}

/**
 * Create batches of subsections that fit within token limits
 * Each batch contains one or more subsections that together don't exceed the limit
 */
export function createSubsectionBatches(
  subsections: SectionInfo[],
  maxTokensPerBatch = 180000
): SectionInfo[][] {
  const batches: SectionInfo[][] = [];
  let currentBatch: SectionInfo[] = [];
  let currentBatchTokens = 0;
  
  for (const subsection of subsections) {
    // If adding this subsection would exceed the limit, start a new batch
    if (currentBatch.length > 0 && currentBatchTokens + subsection.estimatedTokens > maxTokensPerBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchTokens = 0;
    }
    
    // If a single subsection exceeds the limit, it gets its own batch (will handle truncation)
    if (subsection.estimatedTokens > maxTokensPerBatch) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }
      batches.push([subsection]);
      continue;
    }
    
    currentBatch.push(subsection);
    currentBatchTokens += subsection.estimatedTokens;
  }
  
  // Add the final batch if not empty
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate dynamic max_tokens based on estimated input size
 */
export function calculateMaxTokens(estimatedInputTokens: number): number {
  const CLAUDE_CONTEXT_LIMIT = 200000;
  const SAFETY_BUFFER = 2000;
  const MIN_OUTPUT_TOKENS = 8000;
  const MAX_OUTPUT_TOKENS = 16000;
  
  const availableTokens = CLAUDE_CONTEXT_LIMIT - estimatedInputTokens - SAFETY_BUFFER;
  const maxTokens = Math.max(
    MIN_OUTPUT_TOKENS,
    Math.min(MAX_OUTPUT_TOKENS, availableTokens)
  );
  
  console.log(`Token calculation: input=${estimatedInputTokens.toLocaleString()}, available=${availableTokens.toLocaleString()}, max_tokens=${maxTokens.toLocaleString()}`);
  
  return maxTokens;
}

