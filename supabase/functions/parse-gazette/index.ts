import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFExtract } from 'npm:pdf.js-extract@0.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParseRequest {
  issue_id: string;
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

    const { issue_id }: ParseRequest = await req.json();

    if (!issue_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: issue_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing gazette issue: ${issue_id}`);

    const { data: issueData, error: issueError } = await supabase
      .from('gazette_issues')
      .select('pdf_bytes, kind')
      .eq('id', issue_id)
      .single();

    if (issueError || !issueData || !issueData.pdf_bytes) {
      throw new Error('Issue not found or missing PDF data');
    }

    const pdfBytes = new Uint8Array(issueData.pdf_bytes);
    console.log(`Extracting text from PDF: ${pdfBytes.length} bytes`);

    const pdfExtractor = new PDFExtract();
    const data = await pdfExtractor.extractBuffer(pdfBytes);

    const fullText = data.pages
      .map((page: any) => {
        return page.content
          .map((item: any) => item.str)
          .join(' ');
      })
      .join('\n\n');

    console.log(`Extracted ${fullText.length} characters`);

    await supabase
      .from('gazette_issues')
      .update({ pdf_text: fullText })
      .eq('id', issue_id);

    const notices = parseNotices(fullText);
    console.log(`Found ${notices.length} notices`);

    let insertedCount = 0;
    for (const notice of notices) {
      const fingerprint = btoa(
        `${notice.company_name}|${notice.appointment_date}|${notice.appointment_type}`
      ).substring(0, 32);

      const { data: existing } = await supabase
        .from('gazette_notices')
        .select('id')
        .eq('notice_fingerprint', fingerprint)
        .maybeSingle();

      if (existing) {
        console.log(`Notice already exists: ${notice.company_name}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('gazette_notices')
        .insert({
          issue_id,
          section: notice.section,
          company_name: notice.company_name,
          appointment_type: notice.appointment_type,
          appointment_date: notice.appointment_date,
          liquidators: notice.liquidators,
          raw_block: notice.raw_block,
          page_number: notice.page_number,
          notice_fingerprint: fingerprint,
          extraction_confidence: notice.confidence,
          manually_verified: false,
        });

      if (!insertError) {
        insertedCount++;
      }
    }

    const qualityScore = calculateQualityScore(notices, fullText);
    const possibleMisses = findPossibleMisses(fullText, notices);

    await supabase
      .from('gazette_issues')
      .update({
        parsed_count: insertedCount,
        quality_score: qualityScore,
        possible_misses: possibleMisses,
      })
      .eq('id', issue_id);

    if (qualityScore < 90 || possibleMisses.length > 0) {
      await supabase.from('review_queue').insert({
        item_type: 'gazette_issue',
        item_id: issue_id,
        reason: `Low quality score: ${qualityScore.toFixed(1)}% or ${possibleMisses.length} possible misses`,
        priority: qualityScore < 85 ? 'high' : 'medium',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        issue_id,
        notices_found: notices.length,
        notices_inserted: insertedCount,
        quality_score: qualityScore,
        possible_misses: possibleMisses.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Gazette parsing error:', error);

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

function parseNotices(text: string): any[] {
  const notices: any[] = [];

  const companyPatterns = [
    /(?:In the Matter of|RE:|NOTICE OF)\s+([A-Z][A-Za-z0-9\s&,.'-]+(?:LIMITED|LTD|INC|CORPORATION|CORP))/gi,
    /([A-Z][A-Za-z0-9\s&,.'-]+(?:LIMITED|LTD|INC|CORPORATION|CORP))\s+(?:IN LIQUIDATION|IN VOLUNTARY LIQUIDATION)/gi,
  ];

  const appointmentPatterns = [
    /(?:appointed|appointment of)\s+(?:as\s+)?(?:(?:official|provisional|joint)?\s*liquidator|receiver)/gi,
    /(?:voluntary liquidation|official liquidation|receivership)/gi,
  ];

  const datePatterns = [
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
  ];

  const liquidatorPattern = /(?:Liquidator|Official Liquidator|Receiver)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;

  const blocks = text.split(/\n\n+/);

  for (const block of blocks) {
    if (block.length < 50 || !block.match(/liquidat|receiver/i)) {
      continue;
    }

    for (const companyPattern of companyPatterns) {
      const companyMatches = [...block.matchAll(companyPattern)];
      
      for (const companyMatch of companyMatches) {
        const companyName = companyMatch[1].trim();

        let appointmentType = 'unknown';
        const appointmentMatches = [...block.matchAll(appointmentPatterns[0])];
        if (appointmentMatches.length > 0) {
          appointmentType = appointmentMatches[0][0].toLowerCase();
        }

        let appointmentDate: string | null = null;
        const dateMatches = [...block.matchAll(datePatterns[0])];
        if (dateMatches.length > 0) {
          appointmentDate = dateMatches[0][1];
        }

        const liquidators: any[] = [];
        const liquidatorMatches = [...block.matchAll(liquidatorPattern)];
        for (const liqMatch of liquidatorMatches) {
          liquidators.push({
            name: liqMatch[1].trim(),
          });
        }

        notices.push({
          section: 'Liquidations',
          company_name: companyName,
          appointment_type: appointmentType,
          appointment_date: appointmentDate,
          liquidators,
          raw_block: block.substring(0, 500),
          page_number: null,
          confidence: 'medium',
        });
      }
    }
  }

  return notices;
}

function calculateQualityScore(notices: any[], fullText: string): number {
  if (notices.length === 0) return 0;

  let score = 100;

  const withDates = notices.filter(n => n.appointment_date).length;
  const withLiquidators = notices.filter(n => n.liquidators.length > 0).length;
  const withTypes = notices.filter(n => n.appointment_type !== 'unknown').length;

  score -= (notices.length - withDates) * 5;
  score -= (notices.length - withLiquidators) * 10;
  score -= (notices.length - withTypes) * 3;

  return Math.max(0, Math.min(100, score));
}

function findPossibleMisses(text: string, notices: any[]): any[] {
  const misses: any[] = [];
  const keywords = ['liquidation', 'liquidator', 'winding up', 'receiver', 'appointed'];

  const lines = text.split('\n');
  const companyNames = new Set(notices.map(n => n.company_name.toLowerCase()));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    for (const keyword of keywords) {
      if (line.includes(keyword)) {
        const companyMatch = line.match(/([a-z][a-z\s&,.'-]+(?:limited|ltd|inc|corporation|corp))/i);
        
        if (companyMatch) {
          const candidate = companyMatch[1].trim();
          if (!companyNames.has(candidate.toLowerCase()) && candidate.length > 10) {
            const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join(' ');
            
            misses.push({
              phrase_matched: keyword,
              company_name_candidate: candidate,
              surrounding_text: context.substring(0, 200),
              character_position: i,
              reason: `Found "${keyword}" near company name but no matching notice`,
            });
          }
        }
      }
    }
  }

  return misses.slice(0, 10);
}
