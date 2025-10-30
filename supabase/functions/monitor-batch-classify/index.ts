import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildBatchClassificationPrompt } from './classifier-prompt.ts';
import { checkCaymanHeuristics, detectSignalsHeuristic, extractBasicEntities } from './cayman-heuristics.ts';
import {
  formatError,
  calculateOpenAICost,
  retryWithBackoff,
  isRateLimitError,
} from '../shared/monitor-utils.ts';
import type { LLMClassificationResponse } from '../shared/monitor-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting batch classification...');

    // Load monitor settings
    const { data: settings, error: settingsError } = await supabase
      .from('monitor_settings')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000002')
      .single();

    if (settingsError) {
      throw new Error(`Failed to load settings: ${settingsError.message}`);
    }

    if (!settings.classification_enabled || !settings.openai_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Classification is disabled or OpenAI API key is missing',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = settings.batch_size || 20;
    const threshold = settings.classification_threshold || 0.70;
    const caymanKeywords = settings.cayman_keywords || [];
    const roProviders = settings.ro_providers || [];

    // Fetch pending articles
    const { data: articles, error: articlesError } = await supabase
      .from('monitor_articles')
      .select('id, title, content_raw, content_snippet')
      .eq('status', 'pending')
      .eq('classified', false)
      .limit(batchSize);

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`);
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending articles to classify',
          articles_processed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${articles.length} articles in batch`);

    let articlesProcessed = 0;
    let articlesFailed = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Process articles in batch
    try {
      // Prepare batch for LLM
      const batchInput = articles.map(article => ({
        id: article.id,
        title: article.title,
        content: article.content_raw || article.content_snippet || article.title,
      }));

      const prompt = buildBatchClassificationPrompt(batchInput, roProviders);

      // Call OpenAI API with retry logic
      const classifyBatch = async () => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.openai_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a financial risk analyst. Respond only with valid JSON.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }

        return await response.json();
      };

      const completion = await retryWithBackoff(classifyBatch, 3, 2000);

      // Extract classifications from response
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Track token usage
      const usage = completion.usage;
      if (usage) {
        totalInputTokens = usage.prompt_tokens || 0;
        totalOutputTokens = usage.completion_tokens || 0;
      }

      // Parse LLM response (it should be a JSON array)
      let classifications: LLMClassificationResponse[];
      try {
        const parsed = JSON.parse(content);
        // Handle both array response and object with array property
        classifications = Array.isArray(parsed) ? parsed : (parsed.classifications || [parsed]);
      } catch (parseError) {
        console.error('Failed to parse LLM response:', content);
        throw new Error(`Failed to parse LLM response: ${formatError(parseError)}`);
      }

      // Match classifications back to articles and update
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        
        try {
          // Find matching classification by id or by index
          let classification = classifications.find(c => c.id === article.id);
          if (!classification && i < classifications.length) {
            classification = classifications[i];
          }

          if (!classification) {
            throw new Error('No classification found for article');
          }

          // Prepare signal flags
          const signals = classification.signals_detected || [];
          const signal_financial_decline = signals.includes('financial_decline');
          const signal_fraud = signals.includes('fraud');
          const signal_misstated_financials = signals.includes('misstated_financials');
          const signal_shareholder_dispute = signals.includes('shareholder_dispute');
          const signal_director_duties = signals.includes('director_duties');
          const signal_regulatory_investigation = signals.includes('regulatory_investigation');

          // Determine if review is required (low confidence or high-risk signals)
          const requires_review =
            classification.cayman_confidence < threshold ||
            signal_fraud ||
            signal_regulatory_investigation;

          // Update article
          const { error: updateError } = await supabase
            .from('monitor_articles')
            .update({
              cayman_relevant: classification.cayman_relevant,
              cayman_confidence: classification.cayman_confidence,
              cayman_entities: classification.cayman_entities || [],
              classified: true,
              classification_result: {
                cayman_reasoning: classification.cayman_reasoning,
                summary: classification.summary,
                signal_details: classification.signal_details || {},
              },
              signals,
              signal_financial_decline,
              signal_fraud,
              signal_misstated_financials,
              signal_shareholder_dispute,
              signal_director_duties,
              signal_regulatory_investigation,
              status: 'classified',
              classified_at: new Date().toISOString(),
              requires_review,
              llm_tokens_used: {
                input_tokens: Math.round(totalInputTokens / articles.length),
                output_tokens: Math.round(totalOutputTokens / articles.length),
              },
            })
            .eq('id', article.id);

          if (updateError) {
            throw updateError;
          }

          articlesProcessed++;
        } catch (articleError) {
          const errorMsg = formatError(articleError);
          console.error(`Error processing article ${article.id}: ${errorMsg}`);
          
          // Mark article as failed
          await supabase
            .from('monitor_articles')
            .update({
              status: 'failed',
              processing_errors: [errorMsg],
            })
            .eq('id', article.id);

          articlesFailed++;
        }
      }

      const totalCost = calculateOpenAICost(totalInputTokens, totalOutputTokens);

      console.log(
        `Batch classification completed: ${articlesProcessed} processed, ${articlesFailed} failed, cost: $${totalCost.toFixed(4)}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          articles_processed: articlesProcessed,
          articles_failed: articlesFailed,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          total_cost: totalCost,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (classificationError) {
      const errorMsg = formatError(classificationError);
      console.error(`Batch classification failed: ${errorMsg}`);

      // Fallback: Mark all articles with heuristic-based classification
      for (const article of articles) {
        try {
          const text = `${article.title} ${article.content_raw || article.content_snippet || ''}`;
          const heuristic = checkCaymanHeuristics(text, caymanKeywords, roProviders);
          const fallbackSignals = detectSignalsHeuristic(text);
          const fallbackEntities = extractBasicEntities(text, roProviders);

          await supabase
            .from('monitor_articles')
            .update({
              cayman_relevant: heuristic.likely_relevant,
              cayman_confidence: heuristic.confidence,
              cayman_keywords: heuristic.matched_keywords,
              cayman_entities: fallbackEntities.map(e => ({ ...e, confidence: 0.5 })),
              classified: false, // Mark as not fully classified
              signals: fallbackSignals,
              status: 'failed',
              processing_errors: [`LLM classification failed: ${errorMsg}`],
            })
            .eq('id', article.id);

          articlesFailed++;
        } catch (fallbackError) {
          console.error(`Fallback also failed for article ${article.id}:`, fallbackError);
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          articles_processed: articlesProcessed,
          articles_failed: articlesFailed,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: formatError(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

