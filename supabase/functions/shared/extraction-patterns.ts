export interface ExtractionResult {
  field: string;
  value: any;
  confidence: 'high' | 'medium' | 'low';
  method: 'regex' | 'context' | 'ocr' | 'manual';
  rawMatch?: string;
}

export interface TargetedExtractionConfig {
  fields: string[];
  patterns: Record<string, ExtractionPattern>;
}

export interface ExtractionPattern {
  keywords: string[];
  patterns: RegExp[];
  contextWindow: number;
  validator?: (value: string) => boolean;
  transformer?: (value: string) => any;
}

export const REQUIRED_FIELDS = [
  'parties',
  'registered_office_provider',
  'key_individuals',
  'timeline',
  'financial_summary',
  'liquidators',
  'law_firm'
];

export const EXTRACTION_PATTERNS: Record<string, ExtractionPattern> = {
  registered_office_provider: {
    keywords: ['registered office', 'registered agent', 'registered address'],
    patterns: [
      /registered\s+(?:office|agent)[\s:]+([A-Z][^\n]{20,150}(?:Ltd|Limited|Inc|LLC|Services|Trust))/gi,
      /(?:c\/o|care of)\s+([A-Z][^\n]{20,150}(?:Ltd|Limited|Inc|LLC|Services|Trust))/gi,
    ],
    contextWindow: 200,
    validator: (value) => value.length > 10 && /(?:Ltd|Limited|Inc|Services|Trust)/.test(value),
  },

  petitioner: {
    keywords: ['petitioner', 'plaintiff', 'applicant'],
    patterns: [
      /(?:Petitioner|Plaintiff|Applicant)[\s:]+([A-Z][^\n]{10,150})/gi,
      /In\s+the\s+(?:matter|case)\s+of[\s:]+([A-Z][^\n]{10,150})/gi,
    ],
    contextWindow: 150,
  },

  respondent: {
    keywords: ['respondent', 'defendant', 'company'],
    patterns: [
      /(?:Respondent|Defendant)[\s:]+([A-Z][^\n]{10,150})/gi,
      /(?:In\s+re|RE)[\s:]+([A-Z][^\n]{10,150}(?:LIMITED|LTD|INC|CORP))/gi,
    ],
    contextWindow: 150,
  },

  liquidators: {
    keywords: ['liquidator', 'official liquidator', 'provisional liquidator', 'appointed'],
    patterns: [
      /(?:Official\s+)?(?:Provisional\s+)?Liquidator[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /(?:appointed|appoint)\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:as|to\s+be|of)\s+(?:the\s+)?(?:Official\s+)?(?:Provisional\s+)?Liquidator/gi,
      /Liquidator[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s+of\s+([A-Z][^\n]{10,80}(?:Ltd|Limited|LLP|& Co)))?/gi,
    ],
    contextWindow: 250,
    validator: (value) => {
      const name = value.trim();
      return name.length > 5 && name.length < 100 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(name);
    },
  },

  law_firm: {
    keywords: ['attorney', 'counsel', 'solicitor', 'represented by', 'instructed by'],
    patterns: [
      /(?:Attorneys?|Counsel|Solicitors?)[\s:]+([A-Z][^\n]{10,100})/gi,
      /(?:Represented|Instructed)\s+by[\s:]+([A-Z][^\n]{10,100})/gi,
      /(?:Messrs\.?|M\/s\.?)\s+([A-Z][^\n]{10,80})/gi,
    ],
    contextWindow: 200,
    validator: (value) => value.length > 10 && value.length < 150,
  },

  filing_date: {
    keywords: ['filed', 'filed on', 'date of filing', 'petition filed'],
    patterns: [
      /filed\s+(?:on\s+)?(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/gi,
      /(?:filed|filing)\s+date[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/g,
    ],
    contextWindow: 100,
  },

  hearing_date: {
    keywords: ['hearing', 'hearing date', 'return date', 'adjourned to'],
    patterns: [
      /hearing\s+(?:date|on|scheduled)[\s:]+(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/gi,
      /(?:return|adjourned)\s+(?:date|to)[\s:]+(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/gi,
    ],
    contextWindow: 100,
  },

  winding_up_order_date: {
    keywords: ['order', 'winding up order', 'order made', 'ordered'],
    patterns: [
      /(?:winding\s+up\s+)?order\s+(?:made|dated)[\s:]+(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/gi,
      /ordered\s+(?:on|that)[\s:]+(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})/gi,
    ],
    contextWindow: 150,
  },

  debt_amount: {
    keywords: ['debt', 'owed', 'owing', 'sum of', 'indebtedness', 'liability'],
    patterns: [
      /(?:sum|debt|amount|liability)\s+of\s+(?:USD?|US\$|\$)\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:USD?|US\$|\$)\s*([\d,]+(?:\.\d{2})?)\s+(?:owed|owing|due)/gi,
      /(?:owed|owing|due)[\s:]+(?:USD?|US\$|\$)\s*([\d,]+(?:\.\d{2})?)/gi,
    ],
    contextWindow: 150,
    transformer: (value) => {
      const cleaned = value.replace(/,/g, '');
      return parseFloat(cleaned);
    },
    validator: (value) => !isNaN(parseFloat(value.replace(/,/g, ''))),
  },

  creditor_name: {
    keywords: ['creditor', 'claimant', 'owed to'],
    patterns: [
      /creditor[\s:]+([A-Z][^\n]{10,100}(?:Ltd|Limited|Inc|Corp|LLC|Bank|Fund))/gi,
      /(?:owed|owing)\s+to\s+([A-Z][^\n]{10,100}(?:Ltd|Limited|Inc|Corp|LLC|Bank|Fund))/gi,
    ],
    contextWindow: 150,
  },

  directors: {
    keywords: ['director', 'directors', 'officer', 'officers'],
    patterns: [
      /directors?[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+and\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?)/gi,
      /officers?[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    ],
    contextWindow: 200,
  },
};

export function extractTargetedFields(text: string, targetFields: string[] = REQUIRED_FIELDS): ExtractionResult[] {
  const results: ExtractionResult[] = [];
  const textLower = text.toLowerCase();

  for (const field of targetFields) {
    const pattern = EXTRACTION_PATTERNS[field];
    if (!pattern) continue;

    const hasKeyword = pattern.keywords.some(kw => textLower.includes(kw.toLowerCase()));
    if (!hasKeyword) {
      continue;
    }

    for (const regex of pattern.patterns) {
      const matches = [...text.matchAll(regex)];

      for (const match of matches) {
        const value = match[1]?.trim();
        if (!value) continue;

        if (pattern.validator && !pattern.validator(value)) {
          continue;
        }

        const transformedValue = pattern.transformer ? pattern.transformer(value) : value;

        const confidence = determineConfidence(match, pattern, text);

        results.push({
          field,
          value: transformedValue,
          confidence,
          method: 'regex',
          rawMatch: match[0],
        });
      }
    }
  }

  return results;
}

function determineConfidence(
  match: RegExpMatchArray,
  pattern: ExtractionPattern,
  fullText: string
): 'high' | 'medium' | 'low' {
  const matchText = match[0];
  const value = match[1];

  if (pattern.validator && !pattern.validator(value)) {
    return 'low';
  }

  const keywordCount = pattern.keywords.filter(kw =>
    matchText.toLowerCase().includes(kw.toLowerCase())
  ).length;

  if (keywordCount >= 2) return 'high';
  if (keywordCount === 1) return 'medium';
  return 'low';
}

export function consolidateExtractionResults(results: ExtractionResult[]): Record<string, any> {
  const consolidated: Record<string, any> = {};
  const metadata: Record<string, any> = {};

  const groupedByField = results.reduce((acc, result) => {
    if (!acc[result.field]) acc[result.field] = [];
    acc[result.field].push(result);
    return acc;
  }, {} as Record<string, ExtractionResult[]>);

  for (const [field, matches] of Object.entries(groupedByField)) {
    const highConfMatches = matches.filter(m => m.confidence === 'high');
    const bestMatches = highConfMatches.length > 0 ? highConfMatches : matches;

    if (field.includes('date') || field === 'liquidators' || field === 'directors') {
      consolidated[field] = bestMatches.map(m => m.value);
      metadata[field] = {
        confidence: bestMatches[0].confidence,
        method: bestMatches[0].method,
        count: bestMatches.length,
      };
    } else if (field === 'debt_amount') {
      consolidated[field] = bestMatches.map(m => ({
        amount: m.value,
        context: m.rawMatch,
      }));
      metadata[field] = {
        confidence: bestMatches[0].confidence,
        method: bestMatches[0].method,
        total_references: bestMatches.length,
      };
    } else {
      consolidated[field] = bestMatches[0].value;
      metadata[field] = {
        confidence: bestMatches[0].confidence,
        method: bestMatches[0].method,
      };
    }
  }

  return { data: consolidated, metadata };
}

export function identifyMissingFields(extractedFields: string[]): string[] {
  return REQUIRED_FIELDS.filter(field => !extractedFields.includes(field));
}

export function calculateExtractionQuality(extractedFields: string[], totalFields: number = REQUIRED_FIELDS.length): number {
  return (extractedFields.length / totalFields) * 100;
}

export function shouldTriggerOCR(text: string, wordCountThreshold: number = 50): boolean {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length < wordCountThreshold;
}

export function identifyRelevantPages(text: string): number[] {
  const pages = text.split(/\n--- PAGE \d+ ---\n/i);
  const relevantPages: number[] = [];

  const relevantKeywords = [
    'petition', 'winding up', 'liquidator', 'debt', 'creditor',
    'order', 'respondent', 'petitioner', 'registered office'
  ];

  pages.forEach((page, index) => {
    const pageLower = page.toLowerCase();
    const keywordMatches = relevantKeywords.filter(kw => pageLower.includes(kw)).length;

    if (keywordMatches >= 2) {
      relevantPages.push(index + 1);
    }
  });

  return relevantPages;
}
