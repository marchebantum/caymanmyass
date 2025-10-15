import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ScrapeRequest {
  kind: 'regular' | 'extraordinary';
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

    const { kind }: ScrapeRequest = await req.json();

    if (!kind || !['regular', 'extraordinary'].includes(kind)) {
      return new Response(
        JSON.stringify({ error: 'Invalid kind: must be "regular" or "extraordinary"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting ${kind} gazette scrape...`);

    const baseUrl = kind === 'regular'
      ? 'https://www.gov.ky/government-gazettes/'
      : 'https://www.gov.ky/extraordinary-gazettes/';

    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch gazette page: ${response.status}`);
    }

    const html = await response.text();

    const pdfLinkRegex = /href="([^"]*\.pdf)"/gi;
    const matches = [...html.matchAll(pdfLinkRegex)];

    const pdfUrls = matches
      .map(m => m[1])
      .filter(url => url.includes('gazette'))
      .map(url => url.startsWith('http') ? url : `https://www.gov.ky${url}`)
      .slice(0, 3);

    console.log(`Found ${pdfUrls.length} gazette PDFs`);

    const results = [];

    for (const pdfUrl of pdfUrls) {
      try {
        console.log(`Processing: ${pdfUrl}`);

        const issueNumber = extractIssueNumber(pdfUrl);
        const issueDate = extractIssueDate(pdfUrl);
        const fingerprint = btoa(`${kind}|${issueNumber}|${issueDate}`).substring(0, 32);

        const { data: existing } = await supabase
          .from('gazette_issues')
          .select('id')
          .eq('run_fingerprint', fingerprint)
          .maybeSingle();

        if (existing) {
          console.log(`Issue already processed: ${issueNumber}`);
          continue;
        }

        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          console.error(`Failed to download PDF: ${pdfUrl}`);
          continue;
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);

        const { data: newIssue, error: insertError } = await supabase
          .from('gazette_issues')
          .insert({
            kind,
            issue_number: issueNumber,
            issue_date: issueDate,
            pdf_url: pdfUrl,
            pdf_bytes: pdfBytes,
            ocr_used: false,
            parsed_count: 0,
            quality_score: null,
            possible_misses: [],
            run_fingerprint: fingerprint,
            manually_reviewed: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting issue:`, insertError);
          continue;
        }

        results.push({
          id: newIssue.id,
          issue_number: issueNumber,
          pdf_size: pdfBytes.length,
        });
      } catch (error) {
        console.error(`Error processing ${pdfUrl}:`, error);
      }
    }

    if (kind === 'regular') {
      await supabase
        .from('app_settings')
        .update({ last_gazette_regular_run: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');
    } else {
      await supabase
        .from('app_settings')
        .update({ last_gazette_extraordinary_run: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');
    }

    return new Response(
      JSON.stringify({
        success: true,
        kind,
        total_found: pdfUrls.length,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Gazette scrape error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractIssueNumber(url: string): string | null {
  const match = url.match(/(?:No\.?|Number)[\s-]?(\d+)/i);
  return match ? match[1] : null;
}

function extractIssueDate(url: string): string | null {
  const match = url.match(/(\d{4})[-_](\d{2})[-_](\d{2})/i);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}
