import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GAZETTE_PROMPT = `You are a specialized legal document extraction system for Cayman Islands Gazettes and Extraordinary Gazettes. Your task is to extract ALL liquidation-related information from the COMMERCIAL section, covering voluntary liquidations, court-ordered liquidations, partnerships, and final meetings, then output structured JSON data.

SCOPE OF EXTRACTION
Extract from these COMMERCIAL subsections ONLY:

✅ Section 1: "Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors"
✅ Section 2: "Notices of Final Meeting of Shareholders"
✅ Section 3: "Partnership Notices"
✅ Section 4: "Grand Court Notices" (ONLY liquidation-related notices)

❌ DO NOT extract from: Bankruptcy Notices, Receivership Notices, Dividend Notices, Dormant Accounts, Strike Notices, Reduction of Capital, Merger Notices, Transfer of Companies, Struck-off Lists, Demand Notices, Regulatory Agency Notices, or Government sections

STEP 1: DOCUMENT VALIDATION
Before extraction, perform these validation checks:

- Identify the gazette type: Gazette or Extraordinary Gazette
- Extract gazette metadata: Issue number (e.g., "22/2025", "Ex84/2025"), Publication date (e.g., "Monday, 27 October 2025")
- Locate the CONTENTS page (if present) and identify page numbers for each target section
- Validate each target section: If section exists → Proceed to extract; If section shows "None" or absent → Skip that section
- Special validation for Grand Court Notices: Extract ONLY notices containing terms like "liquidation", "winding up", "liquidator appointed", "cause no.", or "FSD"

STEP 2: SECTION BOUNDARY IDENTIFICATION
For EACH target section that exists, identify clear start and end boundaries by section headings.

STEP 3: EXTRACTION RULES BY SECTION

A. VOLUNTARY LIQUIDATION NOTICES (Section 1)
Identify liquidation type:
- "Voluntary": Look for "voluntary liquidation", "voluntary winding up", "Voluntary Liquidator appointed"
- "Court-Ordered": Look for "Official Liquidator", "Official Liquidation", "FSD Cause No.", court references

For EACH notice, extract:
- entityName: Full legal name exactly as written
- entityType: "Company" (default for this section)
- registrationNo: Include prefixes (CR-, IC-, MC-, etc.); use null if not stated
- liquidationType: "Voluntary" OR "Court-Ordered"
- liquidators: Array of full name(s) of individuals or firm names
- contactEmails: Array of email addresses; empty array if not provided
- courtCauseNo: Only if mentioned (e.g., "FSD 123 of 2025"); use null if not applicable
- liquidationDate: Date liquidation commenced in ISO format YYYY-MM-DD
- finalMeetingDate: Initially null (will populate in Step 4 cross-reference)
- notes: String with additional context

B. FINAL MEETING NOTICES (Section 2)
For EACH notice, extract: Company/Partnership name, Registration number (if stated), Final meeting date, Final meeting location/time (for Notes field). DO NOT create separate JSON entries yet - these will be cross-referenced in Step 4.

C. PARTNERSHIP NOTICES (Section 3)
FILTER FIRST: Only extract partnerships with liquidation language ("voluntary liquidation", "winding up", "liquidator", "dissolution"). IGNORE: Partnership formations, amendments, general notices.

For EACH liquidation notice, extract:
- entityName, entityType: "Partnership"
- registrationNo, liquidationType: "Voluntary"
- liquidators: Array with General Partner or named liquidator(s)
- contactEmails, courtCauseNo: null
- liquidationDate, finalMeetingDate: Initially null
- notes: Include partnership type, General Partner details

D. GRAND COURT NOTICES (Section 4)
FILTER FIRST: Only extract liquidation-related notices (must contain: "liquidation", "winding up", "liquidator", "FSD", "Cause No."). IGNORE: Other court proceedings.

For EACH liquidation notice, extract:
- entityName, entityType: "Company" (or "Partnership" if stated)
- registrationNo: Use null if not stated
- liquidationType: "Court-Ordered"
- liquidators: Array with Official Liquidator name(s)
- contactEmails, courtCauseNo: Extract cause number
- liquidationDate: Order date or petition date in ISO format
- finalMeetingDate: Initially null
- notes: Include petitioner, grounds for winding up

STEP 4: CROSS-REFERENCING FINAL MEETINGS
After extracting all liquidations (Sections 1, 3, 4):
- Compare Final Meeting Notices (Section 2) against all extracted entities
- Match by: Exact entity name match (case-insensitive), OR Registration number match, OR Close name match
- If match found: Populate finalMeetingDate field and update notes field
- If no match found (entity in Final Meeting section but NOT in liquidation sections): Create NEW entry with entityType determined from name/context, liquidationType: "Unknown", liquidationDate: null, notes: "Final meeting notice only; liquidation commenced in prior gazette"

STEP 5: INTERNAL VALIDATION & SELF-CORRECTION
Before outputting, verify:
1. Section Isolation: Confirm EVERY extracted entity came from correct target sections
2. Liquidation Type Accuracy: "Voluntary" vs "Court-Ordered" vs "Unknown"
3. Entity Type Accuracy: "Company" vs "Partnership"
4. Name Accuracy: Complete name, exact capitalization, punctuation
5. Date Format & Logic: ISO format YYYY-MM-DD, liquidation date ≤ gazette publication date
6. Array Fields: liquidators always array (never empty), contactEmails always array (can be empty)
7. Cross-Reference Verification: Check name variations, verify registration numbers match
8. Duplicate Check: Same entity should NOT appear twice UNLESS different segregated portfolios
9. Null vs Empty: Use null for registrationNo, courtCauseNo, liquidationDate, finalMeetingDate when not applicable; Use empty array [] for contactEmails when no emails; NEVER use null for liquidators array

STEP 6: JSON OUTPUT FORMAT

If ANY liquidations found:
{
  "status": "success",
  "gazette": {
    "type": "Gazette",
    "issueNumber": "22/2025",
    "publicationDate": "2025-10-27"
  },
  "summary": {
    "totalEntities": 37,
    "companiesVoluntary": 33,
    "companiesCourtOrdered": 2,
    "partnershipsVoluntary": 2,
    "entitiesWithFinalMeetings": 5
  },
  "liquidations": [
    {
      "entityName": "AGIC BLUE RIDGE (CAYMAN) LIMITED",
      "entityType": "Company",
      "registrationNo": "IC-323061",
      "liquidationType": "Voluntary",
      "liquidators": ["Shu Xu"],
      "contactEmails": ["shu.xu@agic-group.com"],
      "courtCauseNo": null,
      "liquidationDate": "2025-10-17",
      "finalMeetingDate": null,
      "notes": "Voluntary liquidation from 17 October 2025"
    }
  ]
}

Array Sorting: Primary: entityType (Company first, then Partnership); Secondary: liquidationType (Voluntary, Court-Ordered, Unknown); Tertiary: entityName (alphabetical, case-insensitive)

If NO liquidations found:
{
  "status": "no_data",
  "gazette": {...},
  "summary": {...all zeros...},
  "message": "This gazette does not contain any liquidation notices for companies or partnerships in the covered period.",
  "sectionsReviewed": {...},
  "liquidations": []
}

STEP 7: FINAL QUALITY CHECKS
Verify: Valid JSON, all four sections reviewed, correct liquidationType/entityType, final meetings cross-referenced, courtCauseNo captured, no excluded sections, complete entity names, ISO dates, liquidators array has entries, contactEmails is array, no hallucinated info, summary stats match array counts, array properly sorted.

OUTPUT INSTRUCTIONS
CRITICAL: Output ONLY the raw JSON object. Do NOT wrap it in markdown code blocks (no \`\`\`json). Do NOT add any explanatory text before or after the JSON. Start your response with { and end with }. Ensure proper escaping of special characters. Use consistent indentation (2 spaces).`;

interface AnalysisRequest {
  pdf_base64: string;
  gazette_type: string;
  issue_number?: string;
  issue_date?: string;
}

interface GazetteResponse {
  status: string;
  gazette: {
    type: string;
    issueNumber: string;
    publicationDate: string;
  };
  summary: {
    totalEntities: number;
    companiesVoluntary: number;
    companiesCourtOrdered: number;
    partnershipsVoluntary: number;
    entitiesWithFinalMeetings: number;
  };
  message?: string;
  liquidations: LiquidationNotice[];
}

interface LiquidationNotice {
  entityName: string;
  entityType: string;
  registrationNo: string | null;
  liquidationType: string;
  liquidators: string[];
  contactEmails: string[];
  courtCauseNo: string | null;
  liquidationDate: string | null;
  finalMeetingDate: string | null;
  notes: string;
}

function parseClaudeResponse(text: string): GazetteResponse {
  let cleanedText = text.trim();

  const strategies = [
    () => {
      const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      return null;
    },
    () => {
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    },
    () => {
      if (cleanedText.startsWith('{') && cleanedText.endsWith('}')) {
        return JSON.parse(cleanedText);
      }
      return null;
    },
    () => {
      const lines = cleanedText.split('\n');
      const jsonLines = [];
      let inJson = false;

      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          inJson = true;
        }
        if (inJson) {
          jsonLines.push(line);
        }
        if (line.trim().endsWith('}') && inJson) {
          break;
        }
      }

      if (jsonLines.length > 0) {
        return JSON.parse(jsonLines.join('\n'));
      }
      return null;
    },
    () => {
      const startIdx = cleanedText.indexOf('{');
      const endIdx = cleanedText.lastIndexOf('}');

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return JSON.parse(cleanedText.substring(startIdx, endIdx + 1));
      }
      return null;
    }
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result !== null) {
        console.log(`Successfully parsed JSON using strategy ${i + 1}`);
        return result as GazetteResponse;
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error.message);
      continue;
    }
  }

  throw new Error("All parsing strategies failed. Response may not contain valid JSON.");
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const { pdf_base64, gazette_type, issue_number, issue_date }: AnalysisRequest = await req.json();

    if (!pdf_base64 || !gazette_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdf_base64 and gazette_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing ${gazette_type} gazette PDF with Claude...`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
                text: GAZETTE_PROMPT,
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
    const analysisText = result.content[0].text;
    const tokensUsed = {
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
    };

    console.log(`Analysis complete. Tokens used: ${tokensUsed.total_tokens}`);
    console.log("Raw Claude response (first 500 chars):", analysisText.substring(0, 500));

    let gazetteResponse: GazetteResponse;
    try {
      gazetteResponse = parseClaudeResponse(analysisText);
    } catch (parseError) {
      console.error("Failed to parse gazette response JSON:", parseError);
      console.error("Full raw response:", analysisText);
      throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}. Response preview: ${analysisText.substring(0, 200)}`);
    }

    if (!gazetteResponse || typeof gazetteResponse !== 'object') {
      throw new Error("Claude response is not a valid object");
    }

    if (!gazetteResponse.liquidations || !Array.isArray(gazetteResponse.liquidations)) {
      console.warn("Missing or invalid liquidations array, creating empty array");
      gazetteResponse.liquidations = [];
    }

    if (!gazetteResponse.gazette || typeof gazetteResponse.gazette !== 'object') {
      console.warn("Missing gazette metadata in response");
      gazetteResponse.gazette = {
        type: gazette_type,
        issueNumber: issue_number || "Unknown",
        publicationDate: issue_date || new Date().toISOString().split('T')[0],
      };
    }

    if (!gazetteResponse.summary || typeof gazetteResponse.summary !== 'object') {
      console.warn("Missing summary statistics in response");
      gazetteResponse.summary = {
        totalEntities: gazetteResponse.liquidations.length,
        companiesVoluntary: 0,
        companiesCourtOrdered: 0,
        partnershipsVoluntary: 0,
        entitiesWithFinalMeetings: 0,
      };
    }

    const notices = gazetteResponse.liquidations || [];
    const summaryStats = gazetteResponse.summary || {
      totalEntities: notices.length,
      companiesVoluntary: 0,
      companiesCourtOrdered: 0,
      partnershipsVoluntary: 0,
      entitiesWithFinalMeetings: 0,
    };

    console.log(`Extracted ${notices.length} liquidation notices`);
    console.log(`Summary: ${summaryStats.totalEntities} total, ${summaryStats.companiesVoluntary} voluntary companies, ${summaryStats.companiesCourtOrdered} court-ordered companies, ${summaryStats.partnershipsVoluntary} partnerships`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));

    const { data: gazetteRecord, error: gazetteError } = await supabase
      .from("analyzed_gazette_pdfs")
      .insert({
        gazette_type,
        issue_number: issue_number || gazetteResponse.gazette?.issueNumber || null,
        issue_date: issue_date || gazetteResponse.gazette?.publicationDate || null,
        pdf_bytes: pdfBytes,
        full_analysis: analysisText,
        notices_count: notices.length,
        summary_stats: summaryStats,
        extraction_metadata: {
          claude_model: "claude-sonnet-4-20250514",
          gazette_type: gazetteResponse.gazette?.type || gazette_type,
          status: gazetteResponse.status,
        },
        llm_tokens_used: tokensUsed,
        uploaded_by: "user",
      })
      .select()
      .single();

    if (gazetteError) {
      console.error("Error saving gazette:", gazetteError);
      throw new Error("Failed to save gazette analysis");
    }

    if (notices.length > 0) {
      const noticeRecords = notices.map((notice) => ({
        analyzed_gazette_id: gazetteRecord.id,
        company_name: notice.entityName,
        entity_type: notice.entityType,
        registration_no: notice.registrationNo,
        liquidation_type: notice.liquidationType,
        liquidators: notice.liquidators,
        contact_emails: notice.contactEmails,
        court_cause_no: notice.courtCauseNo,
        liquidation_date: notice.liquidationDate,
        final_meeting_date: notice.finalMeetingDate,
        notes: notice.notes,
        appointment_type: notice.liquidationType,
        appointment_date: notice.liquidationDate,
        liquidator_name: notice.liquidators?.length > 0 ? notice.liquidators[0] : null,
        liquidator_contact: notice.contactEmails?.length > 0 ? notice.contactEmails.join(", ") : null,
        raw_notice_text: notice.notes,
        extraction_confidence: "high",
      }));

      const { error: noticesError } = await supabase
        .from("gazette_liquidation_notices")
        .insert(noticeRecords);

      if (noticesError) {
        console.error("Error saving notices:", noticesError);
        throw new Error("Failed to save liquidation notices");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gazette_id: gazetteRecord.id,
        notices_count: notices.length,
        summary: summaryStats,
        gazette_metadata: gazetteResponse.gazette,
        notices: notices,
        tokens_used: tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gazette analysis error:", error);

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