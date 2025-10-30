// Shared utility functions for Cayman Monitor feature

/**
 * Generate SHA256 hash of a URL for deduplication
 */
export async function generateUrlHash(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Normalize title for near-duplicate detection
 * Converts to lowercase, trims, removes extra whitespace and punctuation
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Normalize content for analysis
 * Removes excessive whitespace, normalizes newlines
 */
export function normalizeContent(content: string): string {
  return content
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Create a snippet from content (first N characters)
 */
export function createSnippet(content: string | null, maxLength = 500): string {
  if (!content) return '';
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.substring(0, maxLength) + '...';
}

/**
 * Calculate title similarity using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  if (norm1 === norm2) return 1.0;
  
  // Simple Levenshtein distance implementation
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  return 1 - (distance / maxLength);
}

/**
 * Check if article is likely a duplicate based on title similarity
 */
export function isDuplicateTitle(title1: string, title2: string, threshold = 0.85): boolean {
  return calculateTitleSimilarity(title1, title2) >= threshold;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Retry failed'); // Should never reach here
}

/**
 * Check if error is a rate limit error (429)
 */
export function isRateLimitError(error: any): boolean {
  return error?.status === 429 || 
         error?.response?.status === 429 ||
         error?.message?.includes('rate limit');
}

/**
 * Parse date string to ISO format
 */
export function parseDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Check if content contains Cayman keywords (basic heuristic)
 */
export function containsCaymanKeywords(text: string, keywords: string[]): string[] {
  const lowerText = text.toLowerCase();
  return keywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Validate and parse JSON safely
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  return JSON.stringify(error);
}

/**
 * Calculate cost estimate for OpenAI tokens
 */
export function calculateOpenAICost(inputTokens: number, outputTokens: number): number {
  // GPT-4o-mini pricing
  const inputCost = (inputTokens / 1000000) * 0.150;
  const outputCost = (outputTokens / 1000000) * 0.600;
  return inputCost + outputCost;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

