import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CaptureRequest {
  registry_row_id: string;
  box_cdn_url: string;
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

    const { registry_row_id, box_cdn_url }: CaptureRequest = await req.json();

    if (!registry_row_id || !box_cdn_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: registry_row_id and box_cdn_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Capturing PDF for registry row: ${registry_row_id}`);
    console.log(`PDF URL: ${box_cdn_url}`);

    const pdfResponse = await fetch(box_cdn_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!pdfResponse.ok) {
      if (pdfResponse.status === 403 || pdfResponse.status === 404) {
        await supabase
          .from('registry_rows')
          .update({
            box_url_expired: true,
            status: 'expired_link',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registry_row_id);

        return new Response(
          JSON.stringify({ error: 'PDF URL expired or inaccessible', expired: true }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    console.log(`PDF captured: ${pdfBytes.length} bytes`);

    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('registry_row_id', registry_row_id)
      .maybeSingle();

    if (existingCase) {
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          pdf_url: box_cdn_url,
          pdf_bytes: pdfBytes,
          status: 'pdf_captured',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCase.id);

      if (updateError) throw updateError;

      await supabase
        .from('registry_rows')
        .update({
          status: 'pdf_captured',
          box_url_captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', registry_row_id);

      return new Response(
        JSON.stringify({
          success: true,
          case_id: existingCase.id,
          pdf_size: pdfBytes.length,
          message: 'PDF captured and case updated',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const { data: newCase, error: insertError } = await supabase
        .from('cases')
        .insert({
          registry_row_id,
          pdf_url: box_cdn_url,
          pdf_bytes: pdfBytes,
          status: 'pdf_captured',
          ocr_used: false,
          extraction_confidence: 'pending',
          parsed_json: {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase
        .from('registry_rows')
        .update({
          status: 'pdf_captured',
          box_url_captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', registry_row_id);

      return new Response(
        JSON.stringify({
          success: true,
          case_id: newCase.id,
          pdf_size: pdfBytes.length,
          message: 'PDF captured and new case created',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('PDF capture error:', error);

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
