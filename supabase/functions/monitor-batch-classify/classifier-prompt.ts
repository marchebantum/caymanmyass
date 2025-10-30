/**
 * Compact LLM prompt for Cayman relevance and risk signal classification
 */

export interface ClassificationInput {
  title: string;
  content: string;
  ro_providers: string[];
}

export function buildClassificationPrompt(input: ClassificationInput): string {
  return `You are a financial risk analyst specializing in Cayman Islands entities.

Analyze the following news article and determine:
1. Is this article about a Cayman Islands entity? (company, fund, trust, or entity with Cayman connections)
2. What risk signals are present?

ARTICLE:
Title: ${input.title}
Content: ${input.content || 'No content available'}

RISK SIGNALS TO DETECT:
- financial_decline: Signs of financial distress, bankruptcy, insolvency, declining revenues, liquidation
- fraud: Allegations of fraud, corruption, embezzlement, misappropriation, fraudulent misrepresentation
- misstated_financials: Accounting irregularities, restatements, audit issues, financial misstatements
- shareholder_dispute: Shareholder lawsuits, oppression claims, governance conflicts, derivative actions
- director_duties: Director liability, breach of fiduciary duty, wrongful trading, governance failures
- regulatory_investigation: SEC, DOJ, FCA, or other regulatory investigations, enforcement actions, sanctions

CAYMAN INDICATORS:
- Explicit mention of "Cayman Islands", "Grand Cayman", "Cayman domiciled", etc.
- Registered office providers: ${input.ro_providers.join(', ')}
- Cayman-registered, Cayman-incorporated, Cayman-based
- Cayman funds, SPVs, trusts, or investment vehicles

OUTPUT FORMAT (JSON only, no additional text):
{
  "cayman_relevant": true/false,
  "cayman_confidence": 0.0-1.0,
  "cayman_reasoning": "brief explanation why this is or is not Cayman-related",
  "cayman_entities": [
    {
      "name": "Entity Name",
      "type": "ORG|PERSON|GPE|RO_PROVIDER",
      "confidence": 0.0-1.0
    }
  ],
  "signals_detected": ["signal1", "signal2"],
  "signal_details": {
    "signal1": {
      "confidence": 0.0-1.0,
      "evidence": "quote or description from article"
    }
  },
  "summary": "2-3 sentence summary focused on Cayman entity and risks"
}`;
}

/**
 * Batch classification prompt for processing multiple articles at once
 */
export function buildBatchClassificationPrompt(
  articles: Array<{ id: string; title: string; content: string }>,
  ro_providers: string[]
): string {
  const articlesJson = articles.map((article, index) => ({
    id: article.id,
    index,
    title: article.title,
    content: article.content || 'No content available',
  }));

  return `You are a financial risk analyst specializing in Cayman Islands entities.

Analyze the following ${articles.length} news articles. For each article, determine:
1. Is it about a Cayman Islands entity?
2. What risk signals are present?

RISK SIGNALS:
- financial_decline: Financial distress, bankruptcy, insolvency, declining revenues, liquidation
- fraud: Fraud, corruption, embezzlement, misappropriation
- misstated_financials: Accounting irregularities, restatements, audit issues
- shareholder_dispute: Shareholder lawsuits, oppression, governance conflicts
- director_duties: Director liability, breach of fiduciary duty, governance failures
- regulatory_investigation: Regulatory investigations, enforcement, sanctions

CAYMAN INDICATORS:
- Mentions "Cayman Islands", "Grand Cayman", "Cayman domiciled"
- Registered office providers: ${ro_providers.join(', ')}
- Cayman-registered, Cayman-incorporated, Cayman-based entities

ARTICLES:
${JSON.stringify(articlesJson, null, 2)}

OUTPUT FORMAT (JSON array only, one object per article, in same order):
[
  {
    "id": "article_id",
    "cayman_relevant": true/false,
    "cayman_confidence": 0.0-1.0,
    "cayman_reasoning": "brief explanation",
    "cayman_entities": [
      {"name": "Entity Name", "type": "ORG|PERSON|GPE|RO_PROVIDER", "confidence": 0.0-1.0}
    ],
    "signals_detected": ["signal1"],
    "signal_details": {
      "signal1": {"confidence": 0.0-1.0, "evidence": "quote from article"}
    },
    "summary": "2-3 sentence summary"
  }
]`;
}

