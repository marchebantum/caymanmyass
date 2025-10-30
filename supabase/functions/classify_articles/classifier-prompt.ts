/**
 * LLM prompt for classifying articles for Cayman relevance and risk signals
 */

export const SYSTEM_PROMPT = `You are a compliance news triager specializing in Cayman Islands financial entities and offshore structures. Output valid, compact JSON only.

Your task: Determine if a news article relates to Cayman Islands entities or activities, and identify specific risk signals.

Risk signals to detect:
1. financial_decline: Financial distress, losses, declining performance, liquidity issues
2. fraud: Allegations or evidence of fraud, misrepresentation, deception
3. misstated_financials: Accounting irregularities, restatements, audit issues
4. shareholder_issues: Shareholder disputes, oppression, conflicts, activism
5. director_duties: Breaches of director duties, governance failures, conflicts of interest
6. enforcement: Regulatory investigation, enforcement action, sanctions, penalties

Return ONLY valid JSON. No markdown, no code blocks, no explanations.`;

export interface ArticlePayload {
  id: string;
  title: string | null;
  lead: string | null; // First 800-1200 chars of excerpt/body
  source: string;
  published_at: string | null;
}

export interface ClassificationResult {
  is_cayman_related: boolean;
  signals: {
    financial_decline: boolean;
    fraud: boolean;
    misstated_financials: boolean;
    shareholder_issues: boolean;
    director_duties: boolean;
    enforcement: boolean;
  };
  reasons: string[];
  confidence: number; // 0.0 to 1.0
  entities: {
    orgs: string[];
    people: string[];
    locations: string[];
  };
}

/**
 * Build user prompt for a single article
 */
export function buildUserPrompt(article: ArticlePayload): string {
  return JSON.stringify({
    title: article.title || '',
    lead: article.lead || '',
    source: article.source,
    published_at: article.published_at || '',
  });
}

/**
 * Build batch prompt for multiple articles
 */
export function buildBatchPrompt(articles: ArticlePayload[]): string {
  return `Classify each of these ${articles.length} articles. Return a JSON array with one result per article, in the same order.

Articles:
${articles.map((a, i) => `${i + 1}. ${JSON.stringify({
  title: a.title || '',
  lead: a.lead || '',
  source: a.source,
  published_at: a.published_at || '',
})}`).join('\n\n')}

Return format:
[
  {
    "is_cayman_related": true|false,
    "signals": {
      "financial_decline": bool,
      "fraud": bool,
      "misstated_financials": bool,
      "shareholder_issues": bool,
      "director_duties": bool,
      "enforcement": bool
    },
    "reasons": ["short phrase", "another phrase"],
    "confidence": 0.0-1.0,
    "entities": {
      "orgs": ["Company Name"],
      "people": ["Person Name"],
      "locations": ["Location"]
    }
  }
]`;
}

/**
 * Parse LLM response and validate
 */
export function parseClassificationResult(
  response: string
): ClassificationResult | ClassificationResult[] {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (Array.isArray(parsed)) {
      return parsed.map(validateSingleResult);
    } else {
      return validateSingleResult(parsed);
    }
  } catch (error) {
    throw new Error(`Failed to parse classification result: ${error.message}`);
  }
}

function validateSingleResult(result: any): ClassificationResult {
  // Ensure all required fields exist with defaults
  return {
    is_cayman_related: result.is_cayman_related ?? false,
    signals: {
      financial_decline: result.signals?.financial_decline ?? false,
      fraud: result.signals?.fraud ?? false,
      misstated_financials: result.signals?.misstated_financials ?? false,
      shareholder_issues: result.signals?.shareholder_issues ?? false,
      director_duties: result.signals?.director_duties ?? false,
      enforcement: result.signals?.enforcement ?? false,
    },
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
    entities: {
      orgs: Array.isArray(result.entities?.orgs) ? result.entities.orgs : [],
      people: Array.isArray(result.entities?.people) ? result.entities.people : [],
      locations: Array.isArray(result.entities?.locations) ? result.entities.locations : [],
    },
  };
}

/**
 * Prepare article text for classification (limit to ~800-1200 chars)
 */
export function prepareArticleText(
  excerpt: string | null,
  body: string | null,
  maxChars: number = 1000
): string {
  const text = excerpt || body || '';
  if (text.length <= maxChars) {
    return text;
  }
  
  // Truncate at sentence boundary if possible
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > maxChars * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }
  
  return truncated + '...';
}

