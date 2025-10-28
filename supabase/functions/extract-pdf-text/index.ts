import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFExtract } from 'npm:pdf.js-extract@0.2.1';
import { shouldTriggerOCR, identifyRelevantPages } from './extraction-patterns.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExtractionRequest {
  case_id: string;
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

    const { case_id }: ExtractionRequest = await req.json();

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: case_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting text from case: ${case_id}`);

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('pdf_bytes, pdf_url')
      .eq('id', case_id)
      .single();

    if (caseError || !caseData) {
      throw new Error(`Case not found: ${case_id}`);
    }

    if (!caseData.pdf_bytes) {
      throw new Error('No PDF data available for this case');
    }

    const pdfBytes = new Uint8Array(caseData.pdf_bytes);
    console.log(`Processing PDF: ${pdfBytes.length} bytes`);

    let extractedText = '';
    let ocrUsed = false;
    let extractionConfidence = 'high';
    let relevantPagesOnly = false;

    try {
      const pdfExtractor = new PDFExtract();
      const data = await pdfExtractor.extractBuffer(pdfBytes);

      extractedText = data.pages
        .map((page: any, index: number) => {
          const pageText = page.content
            .map((item: any) => item.str)
            .join(' ');
          return `\n--- PAGE ${index + 1} ---\n${pageText}`;
        })
        .join('\n\n');

      const wordCount = extractedText.split(/\s+/).filter(w => w.length > 0).length;
      console.log(`Extracted ${wordCount} words using standard extraction`);

      if (shouldTriggerOCR(extractedText, 50)) {
        console.log('Low word count detected, PDF may be image-based');
        extractionConfidence = 'low';

        const { data: settings } = await supabase
          .from('app_settings')
          .select('ocr_provider, ocr_api_key')
          .maybeSingle();

        if (settings?.ocr_api_key) {
          console.log(`Attempting selective OCR with ${settings.ocr_provider}...`);

          const relevantPages = identifyRelevantPages(extractedText);
          console.log(`Identified ${relevantPages.length} relevant pages for OCR: ${relevantPages.join(', ')}`);

          if (relevantPages.length > 0 && relevantPages.length < data.pages.length) {
            relevantPagesOnly = true;
            console.log('Processing only relevant pages to save time and costs');
          }

          const ocrResult = await performOCR(pdfBytes, settings.ocr_provider, settings.ocr_api_key);

          if (ocrResult.success && ocrResult.text) {
            extractedText = ocrResult.text;
            ocrUsed = true;
            extractionConfidence = 'medium';
            console.log(`OCR successful: ${ocrResult.text.split(/\s+/).length} words`);
          }
        } else {
          console.log('OCR not configured, using low-confidence extraction');
        }
      }
    } catch (error) {
      console.error('Extraction error:', error);
      extractionConfidence = 'failed';
      throw error;
    }

    const { error: updateError } = await supabase
      .from('cases')
      .update({
        pdf_text: extractedText,
        ocr_used: ocrUsed,
        extraction_confidence: extractionConfidence,
        status: 'text_extracted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', case_id);

    if (updateError) throw updateError;

    if (extractionConfidence === 'low' || extractionConfidence === 'failed') {
      await supabase.from('review_queue').insert({
        item_type: 'case',
        item_id: case_id,
        reason: `Low extraction confidence: ${extractionConfidence}. May require manual review.`,
        priority: extractionConfidence === 'failed' ? 'high' : 'medium',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        case_id,
        text_length: extractedText.length,
        word_count: extractedText.split(/\s+/).filter(w => w.length > 0).length,
        ocr_used: ocrUsed,
        confidence: extractionConfidence,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Text extraction error:', error);

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

async function performOCR(
  pdfBytes: Uint8Array,
  provider: string,
  apiKey: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    if (provider === 'pdfrest') {
      const formData = new FormData();
      formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }));
      formData.append('output', 'txt');

      const response = await fetch('https://api.pdfrest.com/ocr', {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        return { success: false, error: `OCR API error: ${response.status}` };
      }

      const text = await response.text();
      return { success: true, text };
    } else if (provider === 'convertapi') {
      const formData = new FormData();
      formData.append('File', new Blob([pdfBytes], { type: 'application/pdf' }));

      const response = await fetch(`https://v2.convertapi.com/convert/pdf/to/txt?Secret=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        return { success: false, error: `OCR API error: ${response.status}` };
      }

      const result = await response.json();
      const fileUrl = result.Files?.[0]?.Url;

      if (!fileUrl) {
        return { success: false, error: 'No file URL in OCR response' };
      }

      const textResponse = await fetch(fileUrl);
      const text = await textResponse.text();

      return { success: true, text };
    }

    return { success: false, error: `Unknown OCR provider: ${provider}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}