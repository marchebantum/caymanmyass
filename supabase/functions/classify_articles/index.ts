import { createClient } from 'npm:@supabase/supabase-js@2';
import type { ArticleRow } from '../shared/monitor-types-simplified.ts';
import { checkCaymanHeuristics, shouldClassify } from './cayman-heuristics.ts';
import {
  SYSTEM_PROMPT,
  buildBatchPrompt,
  parseClassificationResult,
  prepareArticleText,
  type ArticlePayload,
  type ClassificationResult,
} from './classifier-prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_BATCH_SIZE = 12; // Middle of 8-16 range
const MAX_BATCH_SIZE = 16;

interface ClassifyRequest {
  limit?: number;
  batch_size?: number;
}

/**
 * Call OpenAI API for classification
 */
async function callOpenAI(
  articles: ArticlePayload[],
  apiKey: string
): Promise<ClassificationResult[]> {
  const userPrompt = buildBatchPrompt(articles);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const parsed = parseClassificationResult(content);
  const results = Array.isArray(parsed) ? parsed : [parsed];

  // Track token usage
  const usage = {
    prompt_tokens: data.usage?.prompt_tokens || 0,
    completion_tokens: data.usage?.completion_tokens || 0,
    total_tokens: data.usage?.total_tokens || 0,
  };

  console.log(`OpenAI usage: ${usage.total_tokens} tokens (${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion)`);

  return results;
}

/**
 * Call Anthropic API for classification
 */
async function callAnthropic(
  articles: ArticlePayload[],
  apiKey: string
): Promise<ClassificationResult[]> {
  const userPrompt = buildBatchPrompt(articles);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) {
    throw new Error('No content in Anthropic response');
  }

  const parsed = parseClassificationResult(content);
  const results = Array.isArray(parsed) ? parsed : [parsed];

  // Track token usage
  const usage = {
    input_tokens: data.usage?.input_tokens || 0,
    output_tokens: data.usage?.output_tokens || 0,
    total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };

  console.log(`Anthropic usage: ${usage.total_tokens} tokens (${usage.input_tokens} input + ${usage.output_tokens} output)`);

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Check for API keys
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!openaiKey && !anthropicKey) {
      throw new Error('No LLM API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }

    // Parse request
    const body: ClassifyRequest = await req.json().catch(() => ({}));
    const limit = body.limit || 50;
    const batchSize = Math.min(body.batch_size || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

    console.log(`Starting classification: limit=${limit}, batch_size=${batchSize}`);

    // Fetch unclassified articles
    // Articles where signals is empty object {} or null
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, url, source, title, excerpt, body, published_at, created_at')
      .or('signals.eq.{},signals.is.null')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch articles: ${fetchError.message}`);
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          updated: 0,
          skipped: 0,
          message: 'No unclassified articles found',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${articles.length} unclassified articles`);

    // Pre-filter with heuristics
    const candidates: ArticleRow[] = [];
    let heuristicSkipped = 0;

    for (const article of articles) {
      const decision = shouldClassify(article.title, article.excerpt);
      
      if (decision.shouldProcess) {
        candidates.push(article as ArticleRow);
        console.log(`✓ ${article.id}: ${decision.reason} (${decision.matchedTerms.join(', ') || 'exploration'})`);
      } else {
        heuristicSkipped++;
        
        // Still update skipped articles with empty classification
        await supabase
          .from('articles')
          .update({
            cayman_flag: false,
            signals: {},
            reasons: [],
            confidence: 0.0,
          })
          .eq('id', article.id);
      }
    }

    console.log(`After heuristic filter: ${candidates.length} candidates, ${heuristicSkipped} skipped`);

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: articles.length,
          updated: 0,
          skipped: heuristicSkipped,
          message: 'All articles filtered out by heuristics',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process in batches
    let totalUpdated = 0;
    let totalSkipped = heuristicSkipped;

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} articles`);

      // Prepare article payloads
      const payloads: ArticlePayload[] = batch.map(article => ({
        id: article.id,
        title: article.title,
        lead: prepareArticleText(article.excerpt, article.body, 1000),
        source: article.source,
        published_at: article.published_at,
      }));

      // Call LLM (prefer OpenAI, fallback to Anthropic)
      let results: ClassificationResult[];
      try {
        if (openaiKey) {
          results = await callOpenAI(payloads, openaiKey);
        } else {
          results = await callAnthropic(payloads, anthropicKey!);
        }
      } catch (error) {
        console.error(`LLM API error for batch: ${error.message}`);
        totalSkipped += batch.length;
        continue;
      }

      // Validate result count matches batch
      if (results.length !== batch.length) {
        console.error(`Result count mismatch: expected ${batch.length}, got ${results.length}`);
        totalSkipped += batch.length;
        continue;
      }

      // Update articles
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j];
        const result = results[j];

        try {
          const { error: updateError } = await supabase
            .from('articles')
            .update({
              cayman_flag: result.is_cayman_related,
              signals: result.signals,
              reasons: result.reasons,
              confidence: result.confidence,
              meta: {
                ...((article.meta as any) || {}),
                raw_classifier: result,
                classified_at: new Date().toISOString(),
              },
            })
            .eq('id', article.id);

          if (updateError) {
            console.error(`Failed to update article ${article.id}: ${updateError.message}`);
            totalSkipped++;
          } else {
            totalUpdated++;
            console.log(`✓ Updated ${article.id}: cayman=${result.is_cayman_related}, confidence=${result.confidence}`);
          }
        } catch (error) {
          console.error(`Error updating article ${article.id}:`, error);
          totalSkipped++;
        }
      }

      // Rate limiting: small delay between batches
      if (i + batchSize < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: articles.length,
        updated: totalUpdated,
        skipped: totalSkipped,
        candidates: candidates.length,
        heuristic_filtered: heuristicSkipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Classification failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
