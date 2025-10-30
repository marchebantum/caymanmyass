/**
 * Heuristic filters for Cayman relevance (pre-LLM filtering)
 */

export interface HeuristicResult {
  likely_relevant: boolean;
  confidence: number;
  matched_keywords: string[];
  matched_ro_providers: string[];
}

/**
 * Quick heuristic check for Cayman relevance
 * This is a fast pre-filter before expensive LLM calls
 */
export function checkCaymanHeuristics(
  text: string,
  caymanKeywords: string[],
  roProviders: string[]
): HeuristicResult {
  const lowerText = text.toLowerCase();
  
  const matched_keywords: string[] = [];
  const matched_ro_providers: string[] = [];
  
  // Check for Cayman keywords
  for (const keyword of caymanKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matched_keywords.push(keyword);
    }
  }
  
  // Check for RO providers
  for (const provider of roProviders) {
    if (lowerText.includes(provider.toLowerCase())) {
      matched_ro_providers.push(provider);
    }
  }
  
  // Calculate confidence based on matches
  let confidence = 0.0;
  
  if (matched_keywords.length > 0) {
    confidence += 0.5;
  }
  
  if (matched_ro_providers.length > 0) {
    confidence += 0.3;
  }
  
  // Boost confidence if multiple matches
  if (matched_keywords.length > 1) {
    confidence += 0.1;
  }
  
  if (matched_ro_providers.length > 1) {
    confidence += 0.1;
  }
  
  // Cap at 0.9 (heuristics alone shouldn't give 100% confidence)
  confidence = Math.min(confidence, 0.9);
  
  const likely_relevant = matched_keywords.length > 0 || matched_ro_providers.length > 0;
  
  return {
    likely_relevant,
    confidence,
    matched_keywords,
    matched_ro_providers,
  };
}

/**
 * Extract potential entity names from text using simple patterns
 * This is a backup for basic entity extraction if LLM fails
 */
export function extractBasicEntities(text: string, roProviders: string[]): Array<{name: string, type: string}> {
  const entities: Array<{name: string, type: string}> = [];
  
  // Check for known RO providers
  const lowerText = text.toLowerCase();
  for (const provider of roProviders) {
    if (lowerText.includes(provider.toLowerCase())) {
      entities.push({ name: provider, type: 'RO_PROVIDER' });
    }
  }
  
  // Simple pattern matching for company names (words ending in Ltd, Inc, Corp, etc.)
  const companyPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Ltd|Limited|Inc|Incorporated|Corp|Corporation|Fund|Trust)/g,
  ];
  
  for (const pattern of companyPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const fullName = match[0];
      if (!entities.find(e => e.name === fullName)) {
        entities.push({ name: fullName, type: 'ORG' });
      }
    }
  }
  
  return entities.slice(0, 10); // Limit to first 10 entities
}

/**
 * Quick signal detection using keywords
 * Used as fallback if LLM classification fails
 */
export function detectSignalsHeuristic(text: string): string[] {
  const signals: string[] = [];
  const lowerText = text.toLowerCase();
  
  const signalKeywords = {
    financial_decline: ['bankrupt', 'insolvency', 'liquidation', 'financial distress', 'debt default', 'asset decline'],
    fraud: ['fraud', 'fraudulent', 'embezzlement', 'misappropriation', 'corruption', 'ponzi'],
    misstated_financials: ['accounting irregularities', 'restatement', 'audit', 'financial misstatement', 'cooking the books'],
    shareholder_dispute: ['shareholder lawsuit', 'derivative action', 'oppression', 'governance conflict'],
    director_duties: ['breach of fiduciary duty', 'director liability', 'wrongful trading', 'governance failure'],
    regulatory_investigation: ['SEC investigation', 'regulatory enforcement', 'DOJ', 'FCA', 'sanctions', 'enforcement action'],
  };
  
  for (const [signal, keywords] of Object.entries(signalKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        signals.push(signal);
        break; // Only add signal once
      }
    }
  }
  
  return signals;
}

