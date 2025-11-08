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
 * Target subsections and their heading patterns
 */
interface TargetSubsection {
  name: string;
  patterns: string[];
}

const TARGET_SUBSECTIONS: TargetSubsection[] = [
  {
    name: "Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors",
    patterns: [
      "\\bLiquidation Notices\\b",
      "\\bNotices of Winding Up\\b",
      "\\bVoluntary Liquidator\\b",
    ],
  },
  {
    name: "Notices of Final Meeting of Shareholders",
    patterns: [
      "\\bNotices? of Final Meeting\\b",
      "\\bFinal Meeting of Shareholders\\b",
    ],
  },
  {
    name: "Partnership Notices",
    patterns: [
      "\\bPartnership Notices\\b",
      "\\bLimited Partnership Notices\\b",
    ],
  },
  {
    name: "Bankruptcy Notices",
    patterns: [
      "\\bBankruptcy Notices\\b",
      "\\bBankruptcy Order\\b",
    ],
  },
  {
    name: "Receivership Notices",
    patterns: [
      "\\bReceivership Notices\\b",
      "\\bNotice of Receiver\\b",
    ],
  },
  {
    name: "Dividend Notices",
    patterns: [
      "\\bDividend Notices?\\b",
      "\\bLiquidation Dividend\\b",
    ],
  },
  {
    name: "Grand Court Notices",
    patterns: [
      "\\bGrand Court Notices\\b",
      "\\bIn the Grand Court\\b",
    ],
  },
];

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

const STOP_SECTION_DEFS: TargetSubsection[] = STOP_AFTER_SUBSECTIONS.map((name) => ({
  name,
  patterns: [`\\b${escapeRegExp(name)}\\b`],
}));

function isLikelyContentsEntry(text: string, index: number): boolean {
  const windowAfter = text.slice(index, index + 200);
  const windowBefore = text.slice(Math.max(0, index - 120), index);
  if (/CONTENTS/i.test(windowBefore)) {
    return true;
  }
  if (/Pg\./i.test(windowAfter)) {
    return true;
  }
  if (/\.{3,}/.test(windowAfter)) {
    return true;
  }
  if (/\bNone\b/i.test(windowAfter)) {
    return true;
  }
  return false;
}

function isHeadingStart(text: string, index: number): boolean {
  if (index <= 0) return true;
  const before = text.slice(Math.max(0, index - 6), index);
  return /\n\s*$/.test(before);
}

function findHeadingIndex(
  text: string,
  target: TargetSubsection,
  startFrom = 0
): number | null {
  for (const pattern of target.patterns) {
    const regex = new RegExp(pattern, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      if (idx < startFrom) {
        continue;
      }
      if (!isHeadingStart(text, idx)) {
        continue;
      }
      if (isLikelyContentsEntry(text, idx)) {
        continue;
      }
      return idx;
    }
  }

  return null;
}

function findNextStopIndex(text: string, startFrom: number): number | null {
  let stopIndex: number | null = null;

  for (const stop of STOP_SECTION_DEFS) {
    const idx = findHeadingIndex(text, stop, startFrom);
    if (idx !== null) {
      stopIndex = stopIndex === null ? idx : Math.min(stopIndex, idx);
    }
  }

  return stopIndex;
}

/**
 * Identify subsection boundaries within the COMMERCIAL section
 */
export function identifySubsections(commercialText: string): SectionInfo[] {
  const matches: { name: string; startIndex: number }[] = [];
  let searchFrom = 0;

  for (const target of TARGET_SUBSECTIONS) {
    const startIndex = findHeadingIndex(commercialText, target, searchFrom);
    if (startIndex === null) {
      console.log(`Subsection not found: ${target.name}`);
      continue;
    }

    matches.push({ name: target.name, startIndex });
    searchFrom = startIndex + 1;
  }

  matches.sort((a, b) => a.startIndex - b.startIndex);

  const subsections: SectionInfo[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { name, startIndex } = matches[i];
    let endIndex = commercialText.length;

    if (i + 1 < matches.length) {
      endIndex = Math.min(endIndex, matches[i + 1].startIndex);
    }

    const stopIndex = findNextStopIndex(commercialText, startIndex + 1);
    if (stopIndex !== null) {
      endIndex = Math.min(endIndex, stopIndex);
    }

    const content = commercialText.slice(startIndex, endIndex);
    const estimatedTokens = estimateTokens(content);

    subsections.push({
      sectionName: name,
      startIndex,
      endIndex,
      content,
      estimatedTokens,
    });
  }

  return subsections;
}

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

