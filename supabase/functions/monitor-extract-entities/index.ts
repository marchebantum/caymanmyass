import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeTitle, formatError } from '../shared/monitor-utils.ts';

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

    console.log('Starting entity extraction...');

    // Fetch classified articles that haven't had entities extracted yet
    const { data: articles, error: articlesError } = await supabase
      .from('monitor_articles')
      .select('id, cayman_entities')
      .eq('status', 'classified')
      .not('cayman_entities', 'eq', '[]');

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`);
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No articles with entities to process',
          articles_processed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${articles.length} articles for entity extraction`);

    let articlesProcessed = 0;
    let entitiesCreated = 0;
    let linksCreated = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const entities = article.cayman_entities as Array<{
          name: string;
          type: string;
          confidence: number;
        }>;

        if (!Array.isArray(entities) || entities.length === 0) {
          continue;
        }

        for (const entity of entities) {
          const entity_name = entity.name;
          const entity_type = entity.type;
          const confidence = entity.confidence || 0.5;
          const normalized_name = normalizeTitle(entity_name);

          // Upsert entity
          const { data: existingEntity, error: selectError } = await supabase
            .from('monitor_entities')
            .select('id, article_count')
            .eq('normalized_name', normalized_name)
            .maybeSingle();

          if (selectError && selectError.code !== 'PGRST116') {
            // PGRST116 is "no rows returned", which is fine
            throw selectError;
          }

          let entityId: string;

          if (existingEntity) {
            // Update existing entity
            const { error: updateError } = await supabase
              .from('monitor_entities')
              .update({
                last_seen: new Date().toISOString(),
                article_count: existingEntity.article_count + 1,
              })
              .eq('id', existingEntity.id);

            if (updateError) {
              throw updateError;
            }

            entityId = existingEntity.id;
          } else {
            // Create new entity
            const { data: newEntity, error: insertError } = await supabase
              .from('monitor_entities')
              .insert({
                entity_name,
                entity_type,
                normalized_name,
                article_count: 1,
                metadata: { first_article_id: article.id },
              })
              .select('id')
              .single();

            if (insertError) {
              if (insertError.code === '23505') {
                // Unique constraint violation - entity was created concurrently
                // Try to fetch it again
                const { data: retryEntity } = await supabase
                  .from('monitor_entities')
                  .select('id')
                  .eq('normalized_name', normalized_name)
                  .single();

                if (retryEntity) {
                  entityId = retryEntity.id;
                } else {
                  throw insertError;
                }
              } else {
                throw insertError;
              }
            } else {
              entityId = newEntity!.id;
              entitiesCreated++;
            }
          }

          // Create link between article and entity
          const { error: linkError } = await supabase
            .from('monitor_article_entities')
            .insert({
              article_id: article.id,
              entity_id: entityId,
              confidence,
              mention_count: 1,
            })
            .select()
            .single();

          if (linkError) {
            if (linkError.code === '23505') {
              // Link already exists - ignore
              continue;
            } else {
              throw linkError;
            }
          }

          linksCreated++;
        }

        articlesProcessed++;
      } catch (articleError) {
        const errorMsg = formatError(articleError);
        console.error(`Error processing article ${article.id}: ${errorMsg}`);
        errors.push(`Article ${article.id}: ${errorMsg}`);
      }
    }

    console.log(
      `Entity extraction completed: ${articlesProcessed} articles processed, ${entitiesCreated} entities created, ${linksCreated} links created`
    );

    return new Response(
      JSON.stringify({
        success: true,
        articles_processed: articlesProcessed,
        entities_created: entitiesCreated,
        links_created: linksCreated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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

