import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  estimateTokens,
  extractCommercialSection,
  identifySubsections,
  analyzeCommercialSection,
  createSubsectionBatches,
  calculateMaxTokens,
  type CommercialSectionAnalysis,
  type SectionInfo,
} from "./pdf-section-splitter.ts";
import { PDFExtract } from "npm:pdf.js-extract@0.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GAZETTE_PROMPT = `You are a specialized legal document extraction system for Cayman Islands Gazettes and Extraordinary Gazettes. Your task is to extract ALL liquidation-related information from the COMMERCIAL section, covering voluntary liquidations, court-ordered liquidations, partnerships, bankruptcies, receiverships, and final meetings, then output structured JSON data.

SCOPE OF EXTRACTION
Extract from these COMMERCIAL subsections ONLY (in this exact order):

✅ Section 1: "Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors"
✅ Section 2: "Notices of Final Meeting of Shareholders"
✅ Section 3: "Partnership Notices"
✅ Section 4: "Bankruptcy Notices"
✅ Section 5: "Receivership Notices"
✅ Section 6: "Dividend Notices"
✅ Section 7: "Grand Court Notices" (ONLY liquidation-related notices)

⛔ STOP EXTRACTION AFTER "Grand Court Notices" - DO NOT process sections beyond this point.

❌ DO NOT extract from: Dormant Accounts Notices, Notice of Special Strike, Reduction of Capital, Certificate of Merger Notices, Transfer of Companies, Struck-off Lists, Demand Notices, Regulatory Agency Notices, General Commercial Notices, or GOVERNMENT sections

🔍 CRITICAL: Gazettes have two parts:
1. CONTENTS PAGE (front pages) - Shows table of contents with page numbers where each section starts
2. ACTUAL CONTENT (numbered pages like Pg.1387) - Contains the full text of liquidation notices

You MUST read the ACTUAL CONTENT pages, not just the CONTENTS page. When the contents shows "Liquidation Notices...Pg.1387", you must navigate to page 1387 in the document and extract from there.

EXAMPLE: If CONTENTS shows:
- "Liquidation Notices...Pg.1387" → Go to page 1387, extract all liquidation notices
- "Partnership Notices...Pg.1415" → Go to page 1415, extract all partnership notices
- "Grand Court Notices...None" → Skip this section entirely, no content to extract

DO NOT return status "no_data" unless ALL target sections show "None" or are absent. Even if only ONE section has content, you must extract it and return status "success".

STEP 1: DOCUMENT VALIDATION
Before extraction, perform these validation checks:

- Identify the gazette type: Gazette or Extraordinary Gazette
- Extract gazette metadata: Issue number (e.g., "22/2025", "Ex84/2025"), Publication date (e.g., "Monday, 27 October 2025")
- Locate the CONTENTS page (if present) - this is just an INDEX showing where sections are located
- For each target section: Check if it has a page number (e.g., "Pg.1387") OR shows "None"
  - If page number exists → PROCEED to that page number and extract content
  - If it shows "None" → SKIP only that specific subsection (other subsections may still have content)
- IMPORTANT: The CONTENTS page is separate from the actual content. You must navigate to the page numbers listed to find the actual liquidation notices.
- Special validation for Grand Court Notices: Extract ONLY notices containing terms like "liquidation", "winding up", "liquidator appointed", "cause no.", or "FSD"

STEP 2: SECTION BOUNDARY IDENTIFICATION
For EACH target section that has a page number in the CONTENTS:
- Navigate to that page number in the document
- Look for the section heading (e.g., "Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors")
- Identify clear start and end boundaries by section headings
- Extract ALL notices between the section start and the next section heading

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

D. BANKRUPTCY NOTICES (Section 4)
FILTER FIRST: Only extract bankruptcy orders related to individuals or entities. IGNORE: General notices unrelated to insolvency.

For EACH bankruptcy notice, extract:
- entityName: Full name of bankrupt individual or entity
- entityType: "Individual" OR "Company" (based on context)
- registrationNo: Use null if not stated
- liquidationType: "Bankruptcy"
- liquidators: Array with Trustee in Bankruptcy name(s) or ["Court-Appointed Trustee"] if unnamed
- contactEmails: Array of email addresses; empty array if not provided
- courtCauseNo: Bankruptcy case number if mentioned
- liquidationDate: Bankruptcy order date in ISO format YYYY-MM-DD
- finalMeetingDate: Initially null
- notes: Include bankruptcy order details, creditor meeting info if mentioned

E. RECEIVERSHIP NOTICES (Section 5)
FILTER FIRST: Only extract notices of receiver appointments for companies or assets. IGNORE: General commercial notices.

For EACH receivership notice, extract:
- entityName: Full name of company under receivership
- entityType: "Company"
- registrationNo: Include prefixes (CR-, IC-, MC-, etc.); use null if not stated
- liquidationType: "Receivership"
- liquidators: Array with Receiver name(s)
- contactEmails: Array of email addresses; empty array if not provided
- courtCauseNo: Use null unless court-appointed receivership with cause number
- liquidationDate: Date receiver appointed in ISO format YYYY-MM-DD
- finalMeetingDate: Initially null
- notes: Include appointing party (e.g., secured creditor), assets covered

F. DIVIDEND NOTICES (Section 6)
FILTER FIRST: Only extract notices related to dividend distributions in liquidation proceedings. IGNORE: Regular corporate dividend declarations.

For EACH liquidation dividend notice, extract:
- entityName: Full name of company in liquidation
- entityType: "Company"
- registrationNo: Include prefixes; use null if not stated
- liquidationType: "Dividend Distribution" (indicates company already in liquidation)
- liquidators: Array with Liquidator name(s) distributing dividend
- contactEmails: Array of contact emails for dividend claims
- courtCauseNo: Use null unless court-supervised liquidation
- liquidationDate: Use null (liquidation date not in this notice type)
- finalMeetingDate: Initially null
- notes: Include dividend payment date, claim deadline, distribution details

G. GRAND COURT NOTICES (Section 7)
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
After extracting all liquidations (Sections 1, 3, 4, 5, 6, 7):
- Compare Final Meeting Notices (Section 2) against all extracted entities
- Match by: Exact entity name match (case-insensitive), OR Registration number match, OR Close name match
- If match found: Populate finalMeetingDate field and update notes field
- If no match found (entity in Final Meeting section but NOT in liquidation sections): Create NEW entry with entityType determined from name/context, liquidationType: "Unknown", liquidationDate: null, notes: "Final meeting notice only; liquidation commenced in prior gazette"

STEP 5: INTERNAL VALIDATION & SELF-CORRECTION
Before outputting, verify:
1. Section Isolation: Confirm EVERY extracted entity came from correct target sections (stopped after Grand Court Notices)
2. Liquidation Type Accuracy: "Voluntary" vs "Court-Ordered" vs "Bankruptcy" vs "Receivership" vs "Dividend Distribution" vs "Unknown"
3. Entity Type Accuracy: "Company" vs "Partnership" vs "Individual" (for bankruptcies)
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
Verify: Valid JSON, all seven sections reviewed, correct liquidationType/entityType (including Bankruptcy, Receivership, Dividend Distribution), final meetings cross-referenced, courtCauseNo captured, stopped after Grand Court Notices, complete entity names, ISO dates, liquidators array has entries, contactEmails is array, no hallucinated info, summary stats match array counts, array properly sorted.

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
      if (cleanedText.startsWith('{') && cleanedText.endsWith('}')) {
        return JSON.parse(cleanedText);
      }
      return null;
    },
    () => {
      const startIdx = cleanedText.indexOf('{');
      const endIdx = cleanedText.lastIndexOf('}');

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = cleanedText.substring(startIdx, endIdx + 1);
        return JSON.parse(jsonStr);
      }
      return null;
    },
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
      const lines = cleanedText.split('\n');
      let braceCount = 0;
      let startLine = -1;
      let endLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') {
            if (braceCount === 0) startLine = i;
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endLine = i;
              break;
            }
          }
        }
        if (endLine !== -1) break;
      }

      if (startLine !== -1 && endLine !== -1) {
        const jsonStr = lines.slice(startLine, endLine + 1).join('\n');
        return JSON.parse(jsonStr);
      }
      return null;
    }
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result !== null) {
        console.log(`Successfully parsed JSON using strategy ${i + 1}`);
        return result as GazetteResponse;
      }
    } catch (error) {
      lastError = error;
      console.log(`Strategy ${i + 1} failed:`, error.message);
      continue;
    }
  }

  console.error("All parsing strategies failed.");
  console.error("Text length:", cleanedText.length);
  console.error("First 1000 chars:", cleanedText.substring(0, 1000));
  console.error("Last 500 chars:", cleanedText.substring(Math.max(0, cleanedText.length - 500)));
  console.error("Last error:", lastError?.message);

  throw new Error(`All parsing strategies failed. Last error: ${lastError?.message || 'Unknown'}. Text length: ${cleanedText.length}`);
}

async function extractPdfText(pdf_base64: string): Promise<string> {
  console.log("Extracting text from PDF using pdf.js-extract...");

  const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));

  try {
    const pdfExtractor = new PDFExtract();
    const data = await pdfExtractor.extractBuffer(pdfBytes);

    const extractedText = data.pages
      .map((page: any, index: number) => {
        const pageText = page.content
          .map((item: any) => item.str)
          .join(" ");
        return `\n--- PAGE ${index + 1} ---\n${pageText}`;
      })
      .join("\n\n");

    console.log(
      `PDF text extraction complete. Pages: ${data.pages.length}, characters: ${extractedText.length}`
    );

    return extractedText;
  } catch (error) {
    console.error("Failed to extract PDF text via pdf.js-extract:", error);
    throw new Error(
      `Failed to extract PDF text via pdf.js-extract: ${
        (error as Error).message ?? error
      }`
    );
  }
}

async function analyzeWithClaude(
  content: string,
  prompt: string,
  anthropicApiKey: string,
  maxTokens: number,
  isPdfDocument = false,
  pdf_base64?: string
): Promise<{ text: string; tokensUsed: any; stopReason: string }> {
  const messages: any[] = [
    {
      role: "user",
      content: isPdfDocument
        ? [
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
              text: prompt,
            },
          ]
        : [
            {
              type: "text",
              text: `${content}\n\n${prompt}`,
            },
          ],
    },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();

  if (!result.content || !result.content[0] || !result.content[0].text) {
    throw new Error("Invalid response from Claude API");
  }

  return {
    text: result.content[0].text,
    tokensUsed: {
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
    },
    stopReason: result.stop_reason,
  };
}

async function processSectionBatches(
  subsections: SectionInfo[],
  anthropicApiKey: string,
  gazette_type: string
): Promise<{ mergedResponse: GazetteResponse; totalTokens: number }> {
  console.log(`Processing ${subsections.length} subsections in batch mode...`);
  
  const batches = createSubsectionBatches(subsections, 180000);
  console.log(`Created ${batches.length} batches`);
  
  const allLiquidations: LiquidationNotice[] = [];
  let totalTokens = 0;
  let gazetteMetadata: any = null;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchSectionNames = batch.map(s => s.sectionName.slice(0, 30) + '...').join(', ');
    console.log(`Processing batch ${i + 1}/${batches.length}: ${batchSectionNames}`);
    
    const batchContent = batch.map(s => s.content).join('\n\n');
    const batchTokens = estimateTokens(batchContent);
    const maxTokens = calculateMaxTokens(batchTokens);
    console.log(`Batch ${i + 1} text preview (first 400 chars): ${batchContent.substring(0, 400).replace(/\s+/g, ' ')}`);
    
    const batchPrompt = GAZETTE_PROMPT.replace(
      /Extract from these COMMERCIAL subsections ONLY.*?(?=STEP 1)/s,
      `Extract from the following COMMERCIAL subsections in this batch:\n${batch.map((s, idx) => `✅ Section ${idx + 1}: "${s.sectionName}"`).join('\n')}\n\n`
    );
    
    try {
      const { text, tokensUsed, stopReason } = await analyzeWithClaude(
        batchContent,
        batchPrompt,
        anthropicApiKey,
        maxTokens,
        false
      );
      
      totalTokens += tokensUsed.total_tokens;
      
      if (stopReason === 'max_tokens') {
        console.warn(`Batch ${i + 1} hit max_tokens limit - response may be truncated`);
      }
      
      const batchResponse = parseClaudeResponse(text);
      
      if (i === 0 && batchResponse.gazette) {
        gazetteMetadata = batchResponse.gazette;
      }
      
      if (batchResponse.liquidations && Array.isArray(batchResponse.liquidations)) {
        allLiquidations.push(...batchResponse.liquidations);
        console.log(`Batch ${i + 1} extracted ${batchResponse.liquidations.length} notices`);
      }
      
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
    }
  }
  
  const summary = {
    totalEntities: allLiquidations.length,
    companiesVoluntary: allLiquidations.filter(l => l.entityType === 'Company' && l.liquidationType === 'Voluntary').length,
    companiesCourtOrdered: allLiquidations.filter(l => l.liquidationType === 'Court-Ordered').length,
    partnershipsVoluntary: allLiquidations.filter(l => l.entityType === 'Partnership').length,
    entitiesWithFinalMeetings: allLiquidations.filter(l => l.finalMeetingDate !== null).length,
  };
  
  const mergedResponse: GazetteResponse = {
    status: allLiquidations.length > 0 ? 'success' : 'no_data',
    gazette: gazetteMetadata || {
      type: gazette_type,
      issueNumber: "Unknown",
      publicationDate: new Date().toISOString().split('T')[0],
    },
    summary,
    liquidations: allLiquidations,
  };
  
  console.log(`Batch processing complete: ${allLiquidations.length} total notices extracted`);
  
  return { mergedResponse, totalTokens };
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

    const estimatedPdfTokens = Math.ceil((pdf_base64.length / 1.33) / 2.5);
    const promptTokens = estimateTokens(GAZETTE_PROMPT);
    const totalEstimatedInputTokens = estimatedPdfTokens + promptTokens;
    
    console.log(`Token estimation: PDF ~${estimatedPdfTokens.toLocaleString()}, prompt ~${promptTokens.toLocaleString()}, total ~${totalEstimatedInputTokens.toLocaleString()}`);
    
    let gazetteResponse: GazetteResponse;
    let tokensUsed: any;
    let processingMode: 'single-pass' | 'batch' = 'single-pass';
    
    if (totalEstimatedInputTokens > 180000) {
      console.log("⚠️  Estimated tokens exceed 180k - switching to BATCH PROCESSING mode");
      processingMode = 'batch';
      
      try {
        const pdfText = await extractPdfText(pdf_base64);
        const analysis = analyzeCommercialSection(pdfText, 180000);
        
        if (analysis.subsections.length === 0) {
          throw new Error("Could not identify any target subsections in the COMMERCIAL section. The gazette may not contain the expected sections.");
        }
        
        const { mergedResponse, totalTokens } = await processSectionBatches(
          analysis.subsections,
          anthropicApiKey,
          gazette_type
        );
        
        gazetteResponse = mergedResponse;
        tokensUsed = {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: totalTokens,
        };
        
        console.log(`✅ Batch processing complete: ${gazetteResponse.liquidations.length} notices from ${analysis.subsections.length} subsections`);
      } catch (batchError) {
        console.error("Batch processing failed:", batchError);
        throw new Error(`Batch processing failed: ${batchError.message}. The gazette may be too large or improperly formatted.`);
      }
    } else {
      console.log("✅ Estimated tokens within limits - using SINGLE-PASS mode");
      processingMode = 'single-pass';
      
      const maxTokens = calculateMaxTokens(totalEstimatedInputTokens);
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
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
        
        if (error.includes('context') || error.includes('token')) {
          throw new Error("The PDF is too large for single-pass processing. Please try again - the system will use batch processing mode.");
        }
        
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const result = await response.json();

      if (!result.content || !result.content[0] || !result.content[0].text) {
        console.error("Invalid Claude API response structure:", JSON.stringify(result));
        throw new Error("Invalid response from Claude API");
      }

      const analysisText = result.content[0].text;
      tokensUsed = {
        input_tokens: result.usage?.input_tokens || 0,
        output_tokens: result.usage?.output_tokens || 0,
        total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
      };

      console.log(`Analysis complete. Tokens used: ${tokensUsed.total_tokens.toLocaleString()} (input: ${tokensUsed.input_tokens.toLocaleString()}, output: ${tokensUsed.output_tokens.toLocaleString()})`);
      console.log(`Response length: ${analysisText.length} characters`);
      console.log("Raw Claude response (first 500 chars):", analysisText.substring(0, 500));
      console.log("Raw Claude response (last 200 chars):", analysisText.substring(Math.max(0, analysisText.length - 200)));

      if (result.stop_reason === 'max_tokens') {
        console.warn("WARNING: Response was truncated due to max_tokens limit!");
        throw new Error("The gazette contains too many liquidation notices. Response was truncated. The system will use batch processing on retry.");
      }

      try {
        gazetteResponse = parseClaudeResponse(analysisText);
      } catch (parseError) {
        console.error("Failed to parse gazette response JSON:", parseError);
        console.error("Full raw response:", analysisText);
        throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}. Response preview: ${analysisText.substring(0, 200)}`);
      }
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

    console.log(`Extracted ${notices.length} liquidation notices using ${processingMode} mode`);
    console.log(`Summary: ${summaryStats.totalEntities} total, ${summaryStats.companiesVoluntary} voluntary companies, ${summaryStats.companiesCourtOrdered} court-ordered companies, ${summaryStats.partnershipsVoluntary} partnerships`);

    if (notices.length === 0) {
      console.warn("⚠️  NO LIQUIDATION NOTICES FOUND");
      console.warn("Response status:", gazetteResponse.status);
      console.warn("Response message:", gazetteResponse.message || "No message provided");
      if (gazetteResponse.gazette) {
        console.warn("Gazette metadata:", JSON.stringify(gazetteResponse.gazette));
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper to convert "Unknown" strings to null for database
    const cleanValue = (val: any) => (val === "Unknown" || val === "" || val === undefined) ? null : val;
    
    const insertData: any = {
      gazette_type,
      issue_number: cleanValue(issue_number) || cleanValue(gazetteResponse.gazette?.issueNumber) || null,
      issue_date: cleanValue(issue_date) || cleanValue(gazetteResponse.gazette?.publicationDate) || null,
      full_analysis: JSON.stringify({
        status: gazetteResponse.status,
        summary: summaryStats,
        notices_count: notices.length,
        processing_mode: processingMode,
      }),
      notices_count: notices.length,
      summary_stats: summaryStats,
      extraction_metadata: {
        claude_model: "claude-sonnet-4-20250514",
        gazette_type: gazetteResponse.gazette?.type || gazette_type,
        status: gazetteResponse.status,
        processing_mode: processingMode,
        estimated_input_tokens: totalEstimatedInputTokens,
        summary_stats: summaryStats,
      },
      llm_tokens_used: tokensUsed,
      uploaded_by: "user",
    };

    console.log("Attempting to insert gazette record...");
    console.log("Insert data keys:", Object.keys(insertData));
    console.log("Gazette type:", insertData.gazette_type);
    console.log("Issue number:", insertData.issue_number);
    console.log("Notices count:", insertData.notices_count);

    const { data: gazetteRecord, error: gazetteError } = await supabase
      .from("analyzed_gazette_pdfs")
      .insert(insertData)
      .select()
      .single();

    if (gazetteError) {
      console.error("Error saving gazette to database:");
      console.error("Error code:", gazetteError.code);
      console.error("Error message:", gazetteError.message);
      console.error("Error details:", JSON.stringify(gazetteError.details));
      console.error("Error hint:", gazetteError.hint);
      throw new Error(`Failed to save gazette analysis: ${gazetteError.message}`);
    }

    console.log("✅ Successfully saved gazette record with ID:", gazetteRecord.id);

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
        liquidation_date: cleanValue(notice.liquidationDate),
        final_meeting_date: cleanValue(notice.finalMeetingDate),
        notes: notice.notes,
        appointment_type: notice.liquidationType,
        appointment_date: cleanValue(notice.liquidationDate),
        liquidator_name: notice.liquidators?.length > 0 ? notice.liquidators[0] : null,
        liquidator_contact: notice.contactEmails?.length > 0 ? notice.contactEmails.join(", ") : null,
        raw_notice_text: notice.notes,
        extraction_confidence: "high",
      }));

      const { error: noticesError } = await supabase
        .from("gazette_liquidation_notices")
        .insert(noticeRecords);

      if (noticesError) {
        console.error("Error saving notices to database:");
        console.error("Error code:", noticesError.code);
        console.error("Error message:", noticesError.message);
        console.error("Error details:", JSON.stringify(noticesError.details));
        console.error("Notice records count:", noticeRecords.length);
        throw new Error(`Failed to save liquidation notices: ${noticesError.message}`);
      }

      console.log(`✅ Successfully saved ${notices.length} liquidation notices`);
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