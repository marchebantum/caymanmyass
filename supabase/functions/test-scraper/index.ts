import { createClient } from 'npm:@supabase/supabase-js@2';
import Firecrawl from 'npm:@mendable/firecrawl-js@1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestRequest {
  test_mode?: 'dry_run' | 'live';
  verbose?: boolean;
}

interface TestLog {
  step: string;
  step_number: number;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  data?: any;
  error_message?: string;
  execution_time_ms: number;
}

interface ParsedRegistryEntry {
  causeNumber: string;
  filingDate: string | null;
  title: string;
  subject: string;
  sourceHtml: string;
}

function parseMarkdownTable(markdown: string): ParsedRegistryEntry[] {
  const entries: ParsedRegistryEntry[] = [];

  const lines = markdown.split('\n').filter(l => l.startsWith('|'));
  if (lines.length < 2) {
    return entries;
  }

  const dataLines = lines.filter(l => !l.includes('---')).slice(1);

  for (const row of dataLines) {
    const cols = row.split('|').map(c => c.trim());

    if (cols.length < 6) continue;

    const causeNumber = cols[1] || '';
    const filingDate = cols[2] || null;
    const title = cols[3] || '';
    const subject = cols[4] || '';
    const register = cols[5] || '';

    const registerLower = register.toLowerCase();
    const subjectLower = subject.toLowerCase();

    if (registerLower.includes('financial') && !registerLower.includes('family')) {
      if (subjectLower.includes('winding up') || subjectLower.includes('petition')) {
        entries.push({
          causeNumber,
          filingDate,
          title,
          subject,
          sourceHtml: row,
        });
      }
    }
  }

  return entries;
}

function parseRegistryTable(html: string, markdown: string = ''): ParsedRegistryEntry[] {
  let entries: ParsedRegistryEntry[] = [];

  if (markdown) {
    entries = parseMarkdownTable(markdown);

    if (entries.length > 0) {
      return entries;
    }
  }

  const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
  const rows = html.match(tableRowRegex) || [];

  for (const row of rows) {
    const cells: string[] = [];
    let match;
    const cellRegexClone = new RegExp(cellRegex.source, cellRegex.flags);

    while ((match = cellRegexClone.exec(row)) !== null) {
      const cellContent = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .trim();
      cells.push(cellContent);
    }

    if (cells.length >= 5) {
      const causeNumber = cells[0]?.trim() || '';
      const filingDate = cells[1]?.trim() || null;
      const title = cells[2]?.trim() || '';
      const subject = cells[3]?.trim() || '';
      const register = cells[4]?.trim() || '';

      const registerLower = register.toLowerCase();
      const subjectLower = subject.toLowerCase();

      if (registerLower.includes('financial') && !registerLower.includes('family')) {
        if (subjectLower.includes('winding up') || subjectLower.includes('petition')) {
          entries.push({
            causeNumber,
            filingDate: filingDate || null,
            title,
            subject,
            sourceHtml: row,
          });
        }
      }
    }
  }

  return entries;
}

function generateFingerprint(entry: ParsedRegistryEntry): string {
  const data = `${entry.causeNumber}|${entry.filingDate}|${entry.title}|${entry.subject}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let testRunId: string | null = null;
  const logs: TestLog[] = [];
  let currentStepNumber = 0;

  async function logStep(
    step: string,
    status: 'success' | 'warning' | 'error' | 'info',
    message: string,
    data?: any,
    error_message?: string,
    execution_time_ms: number = 0
  ) {
    currentStepNumber++;
    const log: TestLog = {
      step,
      step_number: currentStepNumber,
      status,
      message,
      data,
      error_message,
      execution_time_ms,
    };
    logs.push(log);

    if (testRunId) {
      await supabase.from('scraper_test_logs').insert({
        test_run_id: testRunId,
        ...log,
        timestamp: new Date().toISOString(),
      });
    }
  }

  try {
    const { test_mode = 'dry_run', verbose = true }: TestRequest = await req.json().catch(() => ({}));
    const testStartTime = Date.now();

    const { data: testRun, error: testRunError } = await supabase
      .from('scraper_test_runs')
      .insert({
        test_mode,
        started_at: new Date().toISOString(),
        status: 'running',
        triggered_by: 'manual_test',
      })
      .select()
      .single();

    if (testRunError || !testRun) {
      throw new Error('Failed to create test run record');
    }

    testRunId = testRun.id;

    await logStep('initialize', 'info', 'Test run initialized', { test_mode, test_run_id: testRunId });

    const stepStart1 = Date.now();
    const { data: settings } = await supabase
      .from('app_settings')
      .select('firecrawl_api_key, firecrawl_enabled')
      .maybeSingle();

    const firecrawlEnabled = settings?.firecrawl_enabled || false;
    const firecrawlApiKey = settings?.firecrawl_api_key || null;
    const stepTime1 = Date.now() - stepStart1;

    if (!firecrawlEnabled || !firecrawlApiKey) {
      await logStep(
        'validate_api',
        'error',
        'Firecrawl API key not configured or not enabled',
        { firecrawl_enabled: firecrawlEnabled, has_api_key: !!firecrawlApiKey },
        'Please configure Firecrawl API key in Settings and enable it',
        stepTime1
      );

      await supabase.from('scraper_test_runs').update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        total_steps: currentStepNumber,
        failed_steps: 1,
        total_execution_time_ms: Date.now() - testStartTime,
        summary: 'Test failed: Firecrawl not configured',
      }).eq('id', testRunId);

      return new Response(
        JSON.stringify({
          success: false,
          test_run_id: testRunId,
          logs,
          error: 'Firecrawl API key required for testing',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await logStep('validate_api', 'success', 'Firecrawl API key found and enabled', { key_length: firecrawlApiKey.length }, undefined, stepTime1);

    const stepStart2 = Date.now();
    await logStep('initialize_firecrawl', 'info', 'Initializing Firecrawl client');
    const app = new Firecrawl({ apiKey: firecrawlApiKey });
    const stepTime2 = Date.now() - stepStart2;
    await logStep('initialize_firecrawl', 'success', 'Firecrawl client initialized', undefined, undefined, stepTime2);

    const stepStart3 = Date.now();
    await logStep('fetch_website', 'info', 'Fetching public registers page (all registries)');

    let scrapeResult;
    try {
      scrapeResult = await app.scrapeUrl('https://judicial.ky/public-registers/', {
        formats: ['html', 'markdown'],
        waitFor: 5000,
        timeout: 45000,
      });
    } catch (error) {
      const stepTime3 = Date.now() - stepStart3;
      await logStep(
        'fetch_website',
        'error',
        'Failed to fetch website',
        { url: 'https://judicial.ky/public-registers/' },
        error.message,
        stepTime3
      );
      throw error;
    }

    const stepTime3 = Date.now() - stepStart3;

    if (!scrapeResult.success) {
      await logStep(
        'fetch_website',
        'error',
        'Firecrawl returned unsuccessful response',
        { error: scrapeResult.error },
        scrapeResult.error || 'Unknown error',
        stepTime3
      );
      throw new Error('Firecrawl scraping failed: ' + (scrapeResult.error || 'Unknown error'));
    }

    const html = scrapeResult.html || '';
    const markdown = scrapeResult.markdown || '';
    const htmlPreview = html.substring(0, 1000);
    const markdownPreview = markdown.substring(0, 1000);

    await logStep(
      'fetch_website',
      'success',
      `Successfully fetched website (${html.length} characters)`,
      {
        html_length: html.length,
        markdown_length: markdown.length,
        html_preview: htmlPreview,
        markdown_preview: markdownPreview,
        has_table: html.includes('<table'),
        has_tr: html.includes('<tr'),
        has_financial_services: html.toLowerCase().includes('financial services'),
      },
      undefined,
      stepTime3
    );

    const stepStart4 = Date.now();
    await logStep('parse_html', 'info', 'Parsing HTML table for registry entries');

    const tableMatches = html.match(/<table[^>]*>/gi) || [];
    const trMatches = html.match(/<tr[^>]*>/gi) || [];
    const tdMatches = html.match(/<td[^>]*>/gi) || [];
    const hasFinancialServices = html.toLowerCase().includes('financial services');

    const parsedEntries = parseRegistryTable(html, markdown);
    const stepTime4 = Date.now() - stepStart4;

    await logStep(
      'parse_html',
      parsedEntries.length > 0 ? 'success' : 'warning',
      `Parsed ${parsedEntries.length} registry entries from HTML`,
      {
        total_parsed: parsedEntries.length,
        table_count: tableMatches.length,
        tr_count: trMatches.length,
        td_count: tdMatches.length,
        has_financial_services_heading: hasFinancialServices,
        sample_entries: parsedEntries.slice(0, 3).map(e => ({
          cause_number: e.causeNumber,
          subject: e.subject,
          title: e.title?.substring(0, 50),
        })),
      },
      parsedEntries.length === 0 ? 'No entries found in HTML table. Check if page structure has changed.' : undefined,
      stepTime4
    );

    const stepStart5 = Date.now();
    await logStep('validate_entries', 'info', 'Validating Financial Services entries');

    const invalidEntries = parsedEntries.filter(e => !e.causeNumber || e.causeNumber.trim() === '');

    const petitionCases = parsedEntries.filter(e => {
      const subjectLower = e.subject.toLowerCase();
      const titleLower = e.title.toLowerCase();
      const combined = subjectLower + ' ' + titleLower;
      return combined.includes('petition') && !combined.includes('winding');
    });

    const windingUpCases = parsedEntries.filter(e => {
      const subjectLower = e.subject.toLowerCase();
      const titleLower = e.title.toLowerCase();
      const combined = subjectLower + ' ' + titleLower;
      return combined.includes('winding') && combined.includes('petition');
    });

    const stepTime5 = Date.now() - stepStart5;

    await logStep(
      'validate_entries',
      invalidEntries.length > 0 ? 'warning' : 'success',
      `Validated entries: ${windingUpCases.length} Winding Up-Petitions, ${petitionCases.length} Petitions`,
      {
        winding_up_petitions: windingUpCases.length,
        petitions: petitionCases.length,
        total_relevant: parsedEntries.length,
        invalid_entries: invalidEntries.length,
        all_entries_valid: invalidEntries.length === 0,
        winding_up_samples: windingUpCases.slice(0, 2).map(e => e.causeNumber),
        petition_samples: petitionCases.slice(0, 2).map(e => e.causeNumber),
      },
      invalidEntries.length > 0 ? `Found ${invalidEntries.length} invalid entries` : undefined,
      stepTime5
    );

    const stepStart6 = Date.now();
    await logStep('check_duplicates', 'info', 'Checking for existing entries in database');

    const { data: existingRows } = await supabase
      .from('registry_rows')
      .select('cause_number, row_fingerprint');

    const existingCauseNumbers = new Set(existingRows?.map(r => r.cause_number) || []);
    const existingFingerprints = new Set(existingRows?.map(r => r.row_fingerprint) || []);

    const newEntries = parsedEntries.filter(entry => {
      const fingerprint = generateFingerprint(entry);
      return !existingFingerprints.has(fingerprint);
    });

    const newCauseNumbers = newEntries.filter(entry => !existingCauseNumbers.has(entry.causeNumber));

    const stepTime6 = Date.now() - stepStart6;

    await logStep(
      'check_duplicates',
      'success',
      `Duplicate check complete: ${newEntries.length} new entries, ${newCauseNumbers.length} completely new cases`,
      {
        total_in_database: existingRows?.length || 0,
        total_scraped: parsedEntries.length,
        new_entries: newEntries.length,
        new_cause_numbers: newCauseNumbers.length,
        duplicate_entries: parsedEntries.length - newEntries.length,
        new_cases_sample: newCauseNumbers.slice(0, 5).map(e => ({
          cause_number: e.causeNumber,
          subject: e.subject,
          filing_date: e.filingDate,
        })),
      },
      undefined,
      stepTime6
    );

    if (test_mode === 'live' && newEntries.length > 0) {
      const stepStart7 = Date.now();
      await logStep('insert_data', 'info', `Validating and inserting ${newEntries.length} new entries`);

      const validatedEntries = newEntries.filter(entry => {
        const hasValidCauseNumber = entry.causeNumber && entry.causeNumber.trim() !== '';
        const subjectLower = entry.subject.toLowerCase();
        const titleLower = entry.title.toLowerCase();
        const combined = subjectLower + ' ' + titleLower;
        const hasValidSubject = combined.includes('petition') || combined.includes('winding');

        if (!hasValidCauseNumber || !hasValidSubject) {
          console.warn(`VALIDATION FAILED: Rejected ${entry.causeNumber} - Has Cause Number: ${!!hasValidCauseNumber}, Subject: ${!!hasValidSubject}`);
          return false;
        }
        return true;
      });

      if (validatedEntries.length < newEntries.length) {
        await logStep('insert_data', 'warning', `Validation rejected ${newEntries.length - validatedEntries.length} entries`, {
          total_new: newEntries.length,
          validated: validatedEntries.length,
          rejected: newEntries.length - validatedEntries.length
        });
      }

      if (validatedEntries.length > 0) {
        const { error: insertError } = await supabase
          .from('registry_rows')
          .insert(validatedEntries.map(entry => ({
            cause_number: entry.causeNumber,
            filing_date: entry.filingDate,
            title: entry.title,
            subject: entry.subject,
            source_html: entry.sourceHtml,
            row_fingerprint: generateFingerprint(entry),
            register_bucket: 'Financial Services',
            status: 'awaiting_pdf',
            scraped_at: new Date().toISOString(),
          })));

        const stepTime7 = Date.now() - stepStart7;

        if (insertError) {
          await logStep('insert_data', 'error', 'Failed to insert entries', { error: insertError }, insertError.message, stepTime7);
        } else {
          await logStep('insert_data', 'success', `Successfully inserted ${validatedEntries.length} validated entries`, { inserted_count: validatedEntries.length }, undefined, stepTime7);
        }
      } else {
        await logStep('insert_data', 'warning', 'No valid entries to insert after validation', { rejected_all: true });
      }
    } else if (test_mode === 'dry_run') {
      await logStep('insert_data', 'info', 'Dry run mode: No data inserted', { would_insert: newEntries.length });
    }

    const totalTime = Date.now() - testStartTime;
    const successfulSteps = logs.filter(l => l.status === 'success').length;
    const failedSteps = logs.filter(l => l.status === 'error').length;

    await supabase.from('scraper_test_runs').update({
      completed_at: new Date().toISOString(),
      status: failedSteps > 0 ? 'partial' : 'success',
      total_steps: currentStepNumber,
      successful_steps: successfulSteps,
      failed_steps: failedSteps,
      total_entries_found: parsedEntries.length,
      total_execution_time_ms: totalTime,
      summary: `Test completed: Found ${parsedEntries.length} entries, ${newEntries.length} new`,
    }).eq('id', testRunId);

    await logStep('complete', 'success', `Test completed in ${totalTime}ms`, {
      total_time_ms: totalTime,
      successful_steps: successfulSteps,
      failed_steps: failedSteps,
    });

    return new Response(
      JSON.stringify({
        success: true,
        test_run_id: testRunId,
        test_mode,
        summary: {
          total_entries_found: parsedEntries.length,
          winding_up_petitions: windingUpCases.length,
          petitions: petitionCases.length,
          new_entries: newEntries.length,
          new_cause_numbers: newCauseNumbers.length,
          total_execution_time_ms: totalTime,
          successful_steps: successfulSteps,
          failed_steps: failedSteps,
        },
        logs,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Test scraper error:', error);

    await logStep('error', 'error', 'Test failed with exception', undefined, error.message);

    if (testRunId) {
      await supabase.from('scraper_test_runs').update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        total_steps: currentStepNumber,
        failed_steps: logs.filter(l => l.status === 'error').length,
        total_execution_time_ms: Date.now(),
        summary: `Test failed: ${error.message}`,
      }).eq('id', testRunId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        test_run_id: testRunId,
        error: error.message,
        logs,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});