import { createClient } from 'npm:@supabase/supabase-js@2';
import Firecrawl from 'npm:@mendable/firecrawl-js@1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegistryRow {
  cause_number: string;
  filing_date: string | null;
  title: string;
  subject: string;
  source_html: string;
  row_fingerprint: string;
}

interface ParsedRegistryEntry {
  causeNumber: string;
  filingDate: string | null;
  title: string;
  subject: string;
  register: string;
  sourceHtml: string;
  searchUrl: string;
}

function parseMarkdownTable(markdown: string): ParsedRegistryEntry[] {
  const entries: ParsedRegistryEntry[] = [];

  const lines = markdown.split('\n').filter(l => l.startsWith('|'));
  if (lines.length < 2) {
    console.log('No table found in markdown');
    return entries;
  }

  const dataLines = lines.filter(l => !l.includes('---')).slice(1);
  console.log(`Found ${dataLines.length} data rows in markdown table`);

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
        const searchUrl = `https://judicial.ky/public-registers/?register=Financial+Services&text=${encodeURIComponent(causeNumber)}`;

        console.log(`Found Financial Services entry: ${causeNumber} - ${subject}`);
        entries.push({
          causeNumber,
          filingDate,
          title,
          subject,
          register,
          sourceHtml: row,
          searchUrl,
        });
      }
    }
  }

  return entries;
}

function parseRegistryTable(html: string, markdown: string = ''): ParsedRegistryEntry[] {
  let entries: ParsedRegistryEntry[] = [];

  if (markdown) {
    console.log('Attempting markdown parsing first (matches n8n workflow)...');
    entries = parseMarkdownTable(markdown);

    if (entries.length > 0) {
      console.log(`Successfully parsed ${entries.length} entries from markdown`);
      return entries;
    }

    console.log('No entries found in markdown, falling back to HTML parsing...');
  }

  console.log('Attempting HTML parsing...');
  const tableRowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;

  const rows = html.match(tableRowRegex) || [];
  console.log(`Found ${rows.length} total table rows in HTML`);

  for (const row of rows) {
    const cells: string[] = [];
    let match;
    const cellRegexClone = new RegExp(cellRegex.source, cellRegex.flags);

    while ((match = cellRegexClone.exec(row)) !== null) {
      const cellContent = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
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
          const searchUrl = `https://judicial.ky/public-registers/?register=Financial+Services&text=${encodeURIComponent(causeNumber)}`;

          console.log(`Found Financial Services entry: ${causeNumber} - ${subject}`);
          entries.push({
            causeNumber,
            filingDate,
            title,
            subject,
            register,
            sourceHtml: row,
            searchUrl,
          });
        }
      }
    }
  }

  console.log(`Total Financial Services entries found: ${entries.length}`);
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

function parseDateString(dateStr: string | null): string | null {
  if (!dateStr) return null;

  try {
    const ddMmmYyyy = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (ddMmmYyyy) {
      const [, day, month, year] = ddMmmYyyy;
      const monthMap: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const monthNum = monthMap[month.toLowerCase()];
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }

    const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (parts) {
      const [, day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return dateStr;
    }
  } catch (e) {
    console.error('Date parsing error:', e);
  }

  return null;
}

function isWithinLastNDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return true;

  try {
    const caseDate = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - caseDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  } catch (e) {
    console.error('Date comparison error:', e);
    return true;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const jobStartTime = new Date().toISOString();

    const { data: jobRecord, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        job_type: 'registry_daily',
        started_at: jobStartTime,
        status: 'running',
        triggered_by: 'manual',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create job record:', jobError);
    }

    const jobId = jobRecord?.id;

    const { data: settings } = await supabase
      .from('app_settings')
      .select('firecrawl_api_key, firecrawl_enabled, lookback_days')
      .maybeSingle();

    const firecrawlEnabled = settings?.firecrawl_enabled || false;
    const firecrawlApiKey = settings?.firecrawl_api_key || null;
    const lookbackDays = (settings?.lookback_days as number) || 7;

    if (!firecrawlEnabled || !firecrawlApiKey) {
      console.log('Firecrawl not enabled or API key missing. Using manual mode.');

      const { data: existingRows, error: queryError } = await supabase
        .from('registry_rows')
        .select('id, cause_number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (queryError) {
        throw new Error(`Failed to query existing rows: ${queryError.message}`);
      }

      const totalRows = existingRows?.length || 0;
      const awaitingPdf = existingRows?.filter(r => r.status === 'awaiting_pdf').length || 0;
      const analyzed = existingRows?.filter(r => r.status === 'analyzed').length || 0;

      const completedAt = new Date().toISOString();
      const summaryReport = `Registry monitoring check completed (Manual Mode).\nTotal registry entries: ${totalRows}\nAwaiting PDF upload: ${awaitingPdf}\nAnalyzed: ${analyzed}\n\nNOTE: Firecrawl is not enabled. To enable automated scraping:\n1. Get a Firecrawl API key from https://www.firecrawl.dev\n2. Add it in Settings page\n3. Enable Firecrawl scraping\n4. Run this job again`;

      if (jobId) {
        await supabase
          .from('scrape_jobs')
          .update({
            completed_at: completedAt,
            status: 'success',
            items_found: totalRows,
            new_items: awaitingPdf,
            quality_metrics: {
              total_entries: totalRows,
              awaiting_pdf: awaitingPdf,
              analyzed: analyzed,
              monitoring_mode: 'manual',
            },
            summary_report: summaryReport,
          })
          .eq('id', jobId);
      }

      await supabase
        .from('app_settings')
        .update({ last_registry_run: completedAt })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      return new Response(
        JSON.stringify({
          success: true,
          total_rows: totalRows,
          new_rows: 0,
          existing_rows: analyzed,
          new_cause_numbers: [],
          summary: summaryReport,
          mode: 'manual',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Starting Firecrawl scraping with ${lookbackDays}-day lookback period...`);

    const app = new Firecrawl({ apiKey: firecrawlApiKey });

    console.log('Fetching Financial Services registry page...');
    const scrapeResult = await app.scrapeUrl('https://judicial.ky/public-registers/?register=Financial+Services', {
      formats: ['html', 'markdown'],
      waitFor: 5000,
      timeout: 45000,
    });

    if (!scrapeResult.success) {
      throw new Error('Firecrawl scraping failed: ' + (scrapeResult.error || 'Unknown error'));
    }

    const html = scrapeResult.html || '';
    const markdown = scrapeResult.markdown || '';
    const htmlLength = html.length;
    const markdownLength = markdown.length;
    const hasFinancialServicesHeading = html.toLowerCase().includes('financial services');
    const hasTable = html.includes('<table');
    const hasTr = html.includes('<tr');
    const hasTd = html.includes('<td');
    const tableCount = (html.match(/<table[^>]*>/gi) || []).length;
    const trCount = (html.match(/<tr[^>]*>/gi) || []).length;
    const tdCount = (html.match(/<td[^>]*>/gi) || []).length;

    console.log('=== FIRECRAWL SCRAPE RESULTS ===');
    console.log(`HTML length: ${htmlLength} characters`);
    console.log(`Markdown length: ${markdownLength} characters`);
    console.log(`Financial Services heading found: ${hasFinancialServicesHeading}`);
    console.log(`Has <table>: ${hasTable} (count: ${tableCount})`);
    console.log(`Has <tr>: ${hasTr} (count: ${trCount})`);
    console.log(`Has <td>: ${hasTd} (count: ${tdCount})`);
    console.log(`HTML preview (first 800 chars): ${html.substring(0, 800)}`);
    console.log(`Markdown preview (first 500 chars): ${markdown.substring(0, 500)}`);
    console.log('================================');

    const parsedEntries = parseRegistryTable(html, markdown);

    console.log(`Parsed ${parsedEntries.length} Financial Services registry entries (Petition/Winding Up only)`);

    const recentEntries = parsedEntries.filter(entry => {
      const parsedDate = parseDateString(entry.filingDate);
      const isRecent = isWithinLastNDays(parsedDate, lookbackDays);
      if (!isRecent) {
        console.log(`Filtered out older entry: ${entry.causeNumber} (${entry.filingDate})`);
      }
      return isRecent;
    });

    console.log(`After ${lookbackDays}-day filter: ${recentEntries.length} recent entries`);

    const { data: existingRows } = await supabase
      .from('registry_rows')
      .select('cause_number, row_fingerprint');

    const existingCauseNumbers = new Set(
      existingRows?.map(r => String(r.cause_number || '').trim().toUpperCase()).filter(Boolean) || []
    );
    const existingFingerprints = new Set(existingRows?.map(r => r.row_fingerprint) || []);

    const newEntries: RegistryRow[] = [];
    const newCauseNumbers: string[] = [];
    const rejectedEntries: string[] = [];

    for (const entry of recentEntries) {
      const fingerprint = generateFingerprint(entry);
      const causeNumberKey = String(entry.causeNumber || '').trim().toUpperCase();

      if (!causeNumberKey) {
        rejectedEntries.push(`${entry.causeNumber} (Empty cause number)`);
        console.warn(`VALIDATION FAILED: Empty cause number`);
        continue;
      }

      if (!existingFingerprints.has(fingerprint) && !existingCauseNumbers.has(causeNumberKey)) {
        newEntries.push({
          cause_number: entry.causeNumber,
          filing_date: parseDateString(entry.filingDate),
          title: entry.title,
          subject: entry.subject,
          source_html: entry.sourceHtml,
          row_fingerprint: fingerprint,
        });

        newCauseNumbers.push(entry.causeNumber);
        existingCauseNumbers.add(causeNumberKey);
      } else {
        console.log(`Skipping duplicate: ${entry.causeNumber}`);
      }
    }

    if (rejectedEntries.length > 0) {
      console.warn(`Total rejected entries: ${rejectedEntries.length}`);
      console.warn(`Rejected: ${rejectedEntries.join(', ')}`);
    }

    if (newEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('registry_rows')
        .insert(newEntries.map(entry => ({
          ...entry,
          register_bucket: 'Financial Services',
          status: 'awaiting_pdf',
          scraped_at: jobStartTime,
        })));

      if (insertError) {
        console.error('Error inserting new entries:', insertError);
        throw insertError;
      }

      console.log(`Inserted ${newEntries.length} new registry entries`);
    }

    const completedAt = new Date().toISOString();
    const validationWarnings = rejectedEntries.length > 0 ? `\n\nVALIDATION WARNINGS:\nRejected ${rejectedEntries.length} entries that did not meet Financial Services criteria.` : '';
    const summaryReport = `Registry monitoring completed via Firecrawl.\nTarget: Financial Services Registry (Petition & Winding Up-Petition only)\nLookback period: ${lookbackDays} days\nTotal entries parsed: ${parsedEntries.length}\nRecent entries (last ${lookbackDays} days): ${recentEntries.length}\nNew entries found: ${newEntries.length}\nNew cause numbers: ${newCauseNumbers.length}${validationWarnings}\n\n${newCauseNumbers.length > 0 ? `New cases: ${newCauseNumbers.join(', ')}` : 'No new cases detected.'}\n\nNext steps:\n1. Download PDFs from https://judicial.ky/public-registers/?register=Financial+Services\n2. Upload them in the Registry page for analysis`;

    if (jobId) {
      await supabase
        .from('scrape_jobs')
        .update({
          completed_at: completedAt,
          status: 'success',
          items_found: parsedEntries.length,
          new_items: newEntries.length,
          quality_metrics: {
            total_entries_parsed: parsedEntries.length,
            recent_entries: recentEntries.length,
            lookback_days: lookbackDays,
            rejected_entries: rejectedEntries.length,
            new_entries: newEntries.length,
            new_cause_numbers: newCauseNumbers.length,
            monitoring_mode: 'firecrawl',
            target_registry: 'Financial Services',
            target_subjects: ['Petition', 'Winding Up'],
            validation_passed: rejectedEntries.length === 0,
            scrape_metadata: {
              html_length: htmlLength,
              markdown_length: markdownLength,
              has_table: hasTable,
              table_count: tableCount,
              tr_count: trCount,
              td_count: tdCount,
              has_financial_services_heading: hasFinancialServicesHeading,
            },
          },
          summary_report: summaryReport,
        })
        .eq('id', jobId);
    }

    await supabase
      .from('app_settings')
      .update({ last_registry_run: completedAt })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    console.log(summaryReport);

    return new Response(
      JSON.stringify({
        success: true,
        total_rows: parsedEntries.length,
        recent_rows: recentEntries.length,
        new_rows: newEntries.length,
        new_cause_numbers: newCauseNumbers,
        lookback_days: lookbackDays,
        summary: summaryReport,
        mode: 'firecrawl',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Registry monitoring error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        mode: 'error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});