import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GAZETTE_PROMPT = `Extract liquidation notices from this Cayman Islands Gazette PDF.

**CRITICAL: ONLY extract notices from the "Voluntary Liquidator and Creditor Notices" section. Ignore all other sections.**

For EACH company liquidation notice in that section, extract:

1. **Company Name** - Full company name (include any "Ltd.", "Limited", or other suffixes)
2. **Appointment Type** - The type of liquidation/appointment:
   - "Voluntary Liquidation" (most common)
   - "Official Liquidation"
   - "Receivership"
   - "Administration"
   - Or other specific type mentioned
3. **Appointment Date** - The date the liquidator was appointed (format: YYYY-MM-DD)
4. **Liquidator/Receiver Name** - Full name of the appointed liquidator or receiver
5. **Contact Details** - Phone, email, and/or address of the liquidator/receiver

**OUTPUT FORMAT:**

Return a JSON array where each element represents one company notice:

\`\`\`json
[
  {
    "company_name": "Example Company Ltd.",
    "appointment_type": "Voluntary Liquidation",
    "appointment_date": "2024-12-15",
    "liquidator_name": "John Smith",
    "liquidator_contact": "Phone: +1-345-123-4567, Email: jsmith@firm.com, Address: 123 Main St, George Town, Grand Cayman",
    "raw_notice_text": "Original notice text from the PDF...",
    "confidence": "high"
  }
]
\`\`\`

**REQUIREMENTS:**
- ONLY include notices from "Voluntary Liquidator and Creditor Notices" section
- Extract ALL companies in that section - do not skip any
- If appointment date is not explicitly stated, try to infer from context or use null
- Combine all contact information (phone, email, address) into the liquidator_contact field
- Include the full original notice text in raw_notice_text for reference
- Set confidence to "high", "medium", or "low" based on clarity of information
- If any field cannot be determined, use null but still include the notice
- Preserve exact company names including punctuation and suffixes

**WHAT TO EXCLUDE:**
- Notices from other sections (struck off companies, dissolutions, etc.)
- Administrative notices
- Court orders unrelated to liquidation
- Any notice not in the "Voluntary Liquidator and Creditor Notices" section`;

interface AnalysisRequest {
  pdf_base64: string;
  gazette_type: string;
  issue_number?: string;
  issue_date?: string;
}

interface LiquidationNotice {
  company_name: string;
  appointment_type: string;
  appointment_date: string | null;
  liquidator_name: string | null;
  liquidator_contact: string | null;
  raw_notice_text: string;
  confidence: string;
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

    let notices: LiquidationNotice[] = [];
    try {
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        notices = JSON.parse(jsonMatch[1]);
      } else {
        notices = JSON.parse(analysisText);
      }
    } catch (parseError) {
      console.error("Failed to parse notices JSON:", parseError);
      console.log("Raw response:", analysisText);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));

    const { data: gazetteRecord, error: gazetteError } = await supabase
      .from("analyzed_gazette_pdfs")
      .insert({
        gazette_type,
        issue_number: issue_number || null,
        issue_date: issue_date || null,
        pdf_bytes: pdfBytes,
        full_analysis: analysisText,
        notices_count: notices.length,
        extraction_metadata: { claude_model: "claude-sonnet-4-20250514" },
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
        company_name: notice.company_name,
        appointment_type: notice.appointment_type,
        appointment_date: notice.appointment_date,
        liquidator_name: notice.liquidator_name,
        liquidator_contact: notice.liquidator_contact,
        raw_notice_text: notice.raw_notice_text,
        extraction_confidence: notice.confidence || "medium",
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