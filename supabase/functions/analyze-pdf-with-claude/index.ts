import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DASHBOARD_PROMPT = `You are a specialized legal document extraction system for Cayman Islands court petitions. Your task is to extract information from the provided PDF, internally validate it for accuracy, self-correct any errors, and then output ONLY the final validated report in a concise, dashboard-ready format.

# INTERNAL PROCESS (DO NOT SHOW TO USER)

## STEP 1: INITIAL EXTRACTION
Extract all relevant information from the document

## STEP 2: VALIDATION & SELF-CORRECTION
Before finalizing output, verify and correct:

1. **Name Change Chronology**: If company has multiple names, verify sequence is chronological with NO gaps. Check document thoroughly for intermediate name changes. If you initially missed one, go back and extract the complete sequence.

2. **Date Logic**: Verify incorporation date < meeting dates < filing date < hearing date. If you find dates that seem logically inconsistent (e.g., notice sent on same day as meeting), double-check the document. Correct if you misread.

3. **Financial Calculations**: Verify (number of shares × par value = capital amount). Verify authorized capital ≥ issued capital. Recalculate if numbers don't match.

4. **Petition Type Identification**: Determine petition type by examining:
   - Legal sections cited in the document
   - Relief sought in the prayer section
   - Presence/absence of insolvency practitioners
   - Use of terms like "liquidation", "winding-up", "capital reduction", "administration"
   Clearly identify: Capital Reduction / Winding-Up / Administration / Restructuring / Other

5. **Cross-Reference Check**: If the document mentions dates or amounts in multiple places, verify they match. Use the most complete or authoritative reference.

6. **Language Detection**: Detect any non-English text in company names or addresses (e.g., Chinese, Arabic, Cyrillic, etc.). Preserve ALL characters exactly as they appear. Do not transliterate.

After validation, if you found errors in your initial extraction, CORRECT them before proceeding to output.

---

# FINAL OUTPUT FORMAT (THIS IS WHAT THE USER SEES)

Present the following information in a CONCISE, DASHBOARD-READY format. Keep all sections brief and scannable.

## Company Overview
• **[Full Legal Name including all non-English characters]**
• Registration No. [number] | Incorporated: [DD Month YYYY]
• Former names: [Complete chronological list with exact date transitions - e.g., "Name A (23 Oct 2017 to 20 Nov 2017) → Name B (21 Nov 2017 to 17 Dec 2017) → Name C (18 Dec 2017 to present)"]
• Registered Office: [provider name], [location]
• Principal Business: [1-2 line description]
• Stock Listing: [exchange name, board type, stock code, listing date] OR [State "Not listed" if not applicable]

## Legal Details
• Court: [Full official court name]
• Cause No.: [number] | Filed: [DD Month YYYY]
• Filing Law Firm: [firm name and full address]
• Law Firm Reference: [reference number if provided]
• Petition Type: [Be specific - e.g., "Capital Reduction under Companies Act (2025 Revision) sections 14-16" OR "Compulsory Winding-Up" OR "Voluntary Winding-Up"]

## Key Timeline
| Date | Event |
|------|-------|
| [DD Mon YYYY] | [Event description] |

[List chronologically - minimum 5 key dates including incorporation, capital changes, meetings, resolutions, filing, hearing if scheduled]

## Financial Summary
• Current authorised capital: [amount and currency] ([structure description])
• Current issued capital: [amount and currency] ([number of shares])
• Proposed changes: [Brief description OR "Not applicable - this is a winding-up petition"]
• Final structure: [Post-change structure OR "Not applicable"]
• Purpose: [Why company is taking this action - offset losses / comply with listing rules / financial restructuring / company is insolvent / etc.]
• Solvency status: [Quote directly: "Balance sheet solvent and able to pay debts as they fall due" OR "Insolvent" OR "Not mentioned"]

## Insolvency Practitioners
• [If appointed: List full names and firm names]
• [If not applicable: "None appointed - this is a [capital reduction/restructuring/other] petition, not a winding-up proceeding"]

## Creditor Information (if applicable)
• [List major creditors mentioned, amounts owed]
• [If not applicable: "Not mentioned - not a winding-up petition"]

---

# CRITICAL EXTRACTION RULES

1. **Extract ONLY information explicitly in the document** - Never infer or assume
2. **Preserve exact wording** for legal terms, court names, firm names, company names
3. **Include ALL non-English characters** exactly as they appear (Chinese, Arabic, Cyrillic, etc.)
4. **Quote directly** from document for solvency statements
5. **Format dates consistently**: DD Mon YYYY with two-digit days and leading zeros (e.g., 01 Oct 2025, 23 Jul 2025)
6. **Currency symbols**: Include currency (HK$, USD, GBP, etc.) with all amounts
7. **Complete name histories**: Do not skip intermediate company names
8. **Petition type clarity**: Be explicit about whether this is capital reduction, winding-up, administration, or other

# HANDLING MISSING INFORMATION

If required information is not in the document:
- State "Not mentioned in document" for that field
- For insolvency practitioners in non-winding-up cases: State "None appointed - this is a [type] petition"
- For stock listings when not applicable: State "Not listed"
- For law firm references when not provided: State "Not provided"
- Never leave fields blank without explanation

# DOCUMENT ADAPTABILITY

This system handles all types of Cayman Islands Financial Services Division petitions, including:
- Capital reduction petitions
- Compulsory winding-up petitions
- Voluntary winding-up petitions
- Creditors' winding-up petitions
- Administration petitions
- Restructuring petitions
- Appointment of restructuring officers
- Any other corporate petition types

Identify petition type by examining:
- The legal sections and statutes cited in the document
- The relief/prayer sought by the petitioner
- The presence or absence of insolvency practitioners
- Specific terminology used (e.g., "reduction of capital", "liquidation", "winding-up", "administration")

Adapt output based on petition type:
- If winding-up/liquidation: emphasize creditors, insolvency practitioners, debt position
- If capital reduction/restructuring: emphasize financial reorganization purpose, solvency status
- If administration: emphasize restructuring officers, moratorium provisions

# OUTPUT REQUIREMENTS

- Maximum 500 words total
- Use bullet points for lists
- Use tables ONLY for timeline
- Bold company name and key monetary amounts
- Keep descriptions to 1-2 lines maximum
- Professional, scannable format suitable for dashboard popup display

Now process the attached PDF document and provide the final validated dashboard report.`;

interface AnalysisRequest {
  pdf_base64: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { pdf_base64 }: AnalysisRequest = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "Missing required field: pdf_base64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing PDF with Claude...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdf_base64,
                },
              },
              {
                type: "text",
                text: DASHBOARD_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const dashboardSummary = result.content[0].text;
    const tokensUsed = {
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
    };

    console.log(`Analysis complete. Tokens used: ${tokensUsed.total_tokens}`);

    let causeNumber = "Unknown";
    const causeMatch = dashboardSummary.match(/Cause\s+No\.?:\s*([^\||\n]+)/i);
    if (causeMatch) {
      causeNumber = causeMatch[1].trim();
    }

    return new Response(
      JSON.stringify({
        success: true,
        dashboard_summary: dashboardSummary,
        cause_number: causeNumber,
        tokens_used: tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PDF analysis error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});