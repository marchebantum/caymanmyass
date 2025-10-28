import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AnalysisRequest {
  case_id: string;
}

const DASHBOARD_PROMPT = `Extract the following information from the attached Cayman Islands court petition document and present it in a CONCISE, DASHBOARD-READY format. Keep all sections brief and scannable.

**OUTPUT FORMAT: Condensed report suitable for dashboard display**

---

**1. COMPANY OVERVIEW**
Present as a compact summary block:
- Company name (include Chinese characters if present)
- Registration No. [number] | Incorporated: [date]
- Former names (if any): [list with dates]
- Registered Office: [provider name and location]
- Principal Business: [one-line description]
- Stock Listing: [exchange name, code, listing date] OR "Not listed"

**2. LEGAL DETAILS**
- Court: [court name and division]
- Cause No.: [number] | Filed: [date]
- Filing Law Firm: [firm name]
- Petition Type: [capital reduction/winding-up/other] under [Act sections]

**3. KEY TIMELINE**
Present as a condensed table (max 8-10 critical dates):
| Date | Event |
|------|-------|
[Include only: incorporation, major resolutions, EGM dates, filing date, hearing date]

**4. FINANCIAL SUMMARY**
Present as bullet points:
- Current authorised capital: [amount and structure]
- Current issued capital: [amount and number of shares]
- Proposed changes: [brief description - e.g., "Par value HK$0.25→HK$0.01"]
- Purpose: [one sentence - e.g., "Offset accumulated losses and HKSE compliance"]
- Solvency status: [solvent/insolvent + brief note]

**5. INSOLVENCY PRACTITIONERS**
- If appointed: [Names and firms]
- If not appointed: "None - this is a [petition type], not a winding-up"

---

**CRITICAL REQUIREMENTS:**
✓ Keep total output under 500 words
✓ Use bullet points, not paragraphs
✓ Include only essential dates in timeline (not every corporate event)
✓ Preserve exact figures for share capital and monetary amounts
✓ Use "→" arrows to show before/after changes
✓ State "N/A" or "Not specified" for missing information
✓ No explanatory text or elaboration beyond core facts
✓ Format for easy scanning on a dashboard interface

**WHAT TO EXCLUDE:**
✗ Detailed descriptions of legal procedures
✗ Full text of resolutions
✗ Voting percentages unless material
✗ Minor name changes or administrative events
✗ Lengthy addresses (keep to city/jurisdiction)
✗ Article/section citations unless critical`;

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

    const { case_id }: AnalysisRequest = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: case_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing case with LLM: ${case_id}`);

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('pdf_text, registry_row_id, registry_rows(cause_number, title, subject)')
      .eq('id', case_id)
      .single();

    if (caseError || !caseData) {
      throw new Error(`Case not found: ${case_id}`);
    }

    if (!caseData.pdf_text) {
      throw new Error('No extracted text available for this case');
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select('openai_api_key, anthropic_api_key')
      .maybeSingle();

    if (!settings?.openai_api_key || !settings?.anthropic_api_key) {
      throw new Error('LLM API keys not configured. Please add OpenAI and Anthropic API keys in Settings.');
    }

    const text = caseData.pdf_text;
    console.log(`Processing document: ${text.length} characters`);

    const chunks = chunkText(text, 6000);
    console.log(`Split into ${chunks.length} chunks`);

    const chunkSummaries: string[] = [];
    let totalOpenAITokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      const chunkResult = await analyzeChunkWithOpenAI(chunks[i], settings.openai_api_key, DASHBOARD_PROMPT);
      chunkSummaries.push(chunkResult.summary);
      totalOpenAITokens += chunkResult.tokens || 0;
    }

    console.log(`Consolidating ${chunkSummaries.length} chunk summaries with Claude`);
    const consolidationPrompt = `Combine the following chunk summaries into ONE final dashboard-ready case report.
Keep the same 5-section format. Merge bullet lists. Remove duplicates. If a field is missing in all chunks, write "N/A" or "Not specified".
Output must be under 500 words and use the exact dashboard format with sections 1-5.

CHUNK SUMMARIES:
${chunkSummaries.join('\n\n---\n\n')}`;

    const finalResult = await consolidateWithAnthropic(consolidationPrompt, settings.anthropic_api_key);
    const dashboardSummary = finalResult.summary;
    const totalAnthropicTokens = finalResult.tokens || 0;

    const parsedData = parseDashboardSummary(dashboardSummary);
    const extractedFields = Object.keys(parsedData).filter(k => parsedData[k] && parsedData[k] !== 'N/A');
    const missingFields: string[] = [];
    const qualityScore = Math.min(100, (extractedFields.length / 5) * 100);

    const llmTokensUsed = {
      openai_tokens: totalOpenAITokens,
      anthropic_tokens: totalAnthropicTokens,
      total_cost: (totalOpenAITokens * 0.00001) + (totalAnthropicTokens * 0.00003),
      timestamp: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        dashboard_summary: dashboardSummary,
        parsed_json: parsedData,
        analysis_md: dashboardSummary,
        extraction_metadata: { llm_processing: true, chunk_count: chunks.length },
        fields_extracted: extractedFields,
        fields_missing: missingFields,
        extraction_quality_score: qualityScore,
        llm_tokens_used: llmTokensUsed,
        requires_review: qualityScore < 60,
        status: 'analyzed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', case_id);

    if (updateError) throw updateError;

    await supabase
      .from('registry_rows')
      .update({
        status: 'analyzed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseData.registry_row_id);

    return new Response(
      JSON.stringify({
        success: true,
        case_id,
        dashboard_summary: dashboardSummary,
        tokens_used: llmTokensUsed,
        quality_score: qualityScore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Case analysis error:', error);

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

function chunkText(text: string, chunkSize: number): string[] {
  const cleanedText = text.replace(/\s+\n/g, '\n').trim();
  const chunks: string[] = [];

  for (let i = 0; i < cleanedText.length; i += chunkSize) {
    chunks.push(cleanedText.slice(i, i + chunkSize));
  }

  return chunks;
}

async function analyzeChunkWithOpenAI(
  chunkText: string,
  apiKey: string,
  prompt: string
): Promise<{ summary: string; tokens?: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: `Analyze this document chunk:\n\n${chunkText}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    summary: result.choices[0].message.content,
    tokens: result.usage?.total_tokens || 0,
  };
}

async function consolidateWithAnthropic(
  prompt: string,
  apiKey: string
): Promise<{ summary: string; tokens?: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    summary: result.content[0].text,
    tokens: result.usage?.input_tokens + result.usage?.output_tokens || 0,
  };
}

function parseDashboardSummary(summary: string): any {
  return {
    company_overview: extractSection(summary, '1. COMPANY OVERVIEW', '2. LEGAL DETAILS'),
    legal_details: extractSection(summary, '2. LEGAL DETAILS', '3. KEY TIMELINE'),
    timeline: extractSection(summary, '3. KEY TIMELINE', '4. FINANCIAL SUMMARY'),
    financial_summary: extractSection(summary, '4. FINANCIAL SUMMARY', '5. INSOLVENCY PRACTITIONERS'),
    insolvency_practitioners: extractSection(summary, '5. INSOLVENCY PRACTITIONERS', '---'),
    full_summary: summary,
  };
}

function extractSection(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return 'N/A';

  const endIdx = text.indexOf(endMarker, startIdx);
  const section = endIdx === -1 ? text.slice(startIdx) : text.slice(startIdx, endIdx);

  return section.replace(startMarker, '').trim();
}
