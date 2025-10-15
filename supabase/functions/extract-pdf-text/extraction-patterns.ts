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