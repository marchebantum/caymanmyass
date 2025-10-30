/**
 * Cayman Islands heuristics for pre-filtering articles
 */

// Cayman-specific keywords
export const CAYMAN_KEYWORDS = [
  'Cayman Islands',
  'Grand Cayman',
  'CIMA',
  'Cayman-registered',
  'Cayman-domiciled',
  'Segregated Portfolio Company',
  'SPC',
  'Exempted Company',
  'Limited Duration Company',
];

// Registered Office providers (firms operating in Cayman)
export const RO_PROVIDERS = [
  'Maples',
  'Walkers',
  'Ogier',
  'Harneys',
  'Conyers',
  'Mourant',
  'Appleby',
  'Intertrust',
  'Vistra',
  'Trident',
  'Estera',
  'Alter Domus',
];

/**
 * Check if text contains any Cayman-related keywords
 */
export function checkCaymanHeuristics(text: string): {
  isCandidate: boolean;
  matchedTerms: string[];
} {
  if (!text) {
    return { isCandidate: false, matchedTerms: [] };
  }

  const lowerText = text.toLowerCase();
  const matchedTerms: string[] = [];

  // Check keywords
  for (const keyword of CAYMAN_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matchedTerms.push(keyword);
    }
  }

  // Check RO providers
  for (const provider of RO_PROVIDERS) {
    if (lowerText.includes(provider.toLowerCase())) {
      matchedTerms.push(provider);
    }
  }

  return {
    isCandidate: matchedTerms.length > 0,
    matchedTerms,
  };
}

/**
 * Check if article should be classified based on heuristics
 * Allows a small percentage (10%) of non-matching articles for exploration
 */
export function shouldClassify(
  title: string | null,
  excerpt: string | null,
  explorationRate: number = 0.1
): {
  shouldProcess: boolean;
  reason: string;
  matchedTerms: string[];
} {
  const combinedText = `${title || ''} ${excerpt || ''}`;
  const heuristics = checkCaymanHeuristics(combinedText);

  if (heuristics.isCandidate) {
    return {
      shouldProcess: true,
      reason: 'matched_heuristics',
      matchedTerms: heuristics.matchedTerms,
    };
  }

  // Allow small % for exploration (deterministic based on text hash)
  const hash = simpleHash(combinedText);
  const shouldExplore = (hash % 100) < (explorationRate * 100);

  return {
    shouldProcess: shouldExplore,
    reason: shouldExplore ? 'exploration_sample' : 'no_match',
    matchedTerms: [],
  };
}

/**
 * Simple hash function for deterministic exploration sampling
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

