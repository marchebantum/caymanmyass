import { createClient } from 'npm:@supabase/supabase-js@2';
import type { ArticleRow, EntityRow } from '../shared/monitor-types-simplified.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ExtractRequest {
  limit?: number;
}

interface ExtractedEntity {
  name: string;
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  role?: string;
}

/**
 * Extract entities from classifier metadata
 */
function extractEntitiesFromMeta(meta: any): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (!meta?.raw_classifier?.entities) {
    return entities;
  }

  const classifierEntities = meta.raw_classifier.entities;

  // Organizations
  if (Array.isArray(classifierEntities.orgs)) {
    for (const org of classifierEntities.orgs) {
      if (org && typeof org === 'string') {
        entities.push({
          name: org.trim(),
          type: 'ORG',
        });
      }
    }
  }

  // People
  if (Array.isArray(classifierEntities.people)) {
    for (const person of classifierEntities.people) {
      if (person && typeof person === 'string') {
        entities.push({
          name: person.trim(),
          type: 'PERSON',
        });
      }
    }
  }

  // Locations
  if (Array.isArray(classifierEntities.locations)) {
    for (const location of classifierEntities.locations) {
      if (location && typeof location === 'string') {
        entities.push({
          name: location.trim(),
          type: 'GPE',
        });
      }
    }
  }

  return entities;
}

/**
 * Fallback: Extract entities using LLM if not in meta
 */
async function extractEntitiesWithLLM(
  article: ArticleRow,
  openaiKey: string
): Promise<ExtractedEntity[]> {
  const text = article.title || '';
  const excerpt = article.excerpt || '';
  const combinedText = `${text} ${excerpt}`.substring(0, 500);

  if (!combinedText.trim()) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract entities from text. Return JSON: {"orgs": [], "people": [], "locations": []}',
          },
          {
            role: 'user',
            content: combinedText,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error(`LLM API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return [];
    }

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    const entities: ExtractedEntity[] = [];

    if (Array.isArray(parsed.orgs)) {
      entities.push(...parsed.orgs.map((name: string) => ({ name, type: 'ORG' as const })));
    }
    if (Array.isArray(parsed.people)) {
      entities.push(...parsed.people.map((name: string) => ({ name, type: 'PERSON' as const })));
    }
    if (Array.isArray(parsed.locations)) {
      entities.push(...parsed.locations.map((name: string) => ({ name, type: 'GPE' as const })));
    }

    return entities;
  } catch (error) {
    console.error('LLM extraction failed:', error);
    return [];
  }
}

/**
 * Normalize entity name for matching
 */
function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Upsert entity and return ID
 */
async function upsertEntity(
  supabase: any,
  name: string,
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER'
): Promise<string | null> {
  const normalizedName = normalizeEntityName(name);

  // Try to find existing entity by normalized name and type
  const { data: existing, error: findError } = await supabase
    .from('entities')
    .select('id')
    .ilike('name', normalizedName)
    .eq('type', type)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding entity: ${findError.message}`);
    return null;
  }

  if (existing) {
    return existing.id;
  }

  // Create new entity
  const { data: newEntity, error: insertError } = await supabase
    .from('entities')
    .insert({
      name,
      canonical_name: name,
      type,
      aliases: [],
    })
    .select('id')
    .single();

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === '23505') {
      // Try to find again
      const { data: retry } = await supabase
        .from('entities')
        .select('id')
        .ilike('name', normalizedName)
        .eq('type', type)
        .limit(1)
        .maybeSingle();
      
      return retry?.id || null;
    }

    console.error(`Error inserting entity: ${insertError.message}`);
    return null;
  }

  return newEntity?.id || null;
}

/**
 * Link article to entity
 */
async function linkArticleEntity(
  supabase: any,
  articleId: string,
  entityId: string,
  role?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('article_entities')
    .insert({
      article_id: articleId,
      entity_id: entityId,
      role: role || null,
    })
    .select();

  if (error) {
    // Ignore duplicate key errors (already linked)
    if (error.code === '23505') {
      return true;
    }
    console.error(`Error linking article-entity: ${error.message}`);
    return false;
  }

  return true;
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
    // Parse request
    const body: ExtractRequest = await req.json().catch(() => ({}));
    const limit = body.limit || 100;

    console.log(`Starting entity extraction: limit=${limit}`);

    // Fetch classified articles without entity links
    // Join with article_entities and filter for articles with no links
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        excerpt,
        body,
        meta
      `)
      .not('cayman_flag', 'is', null)
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
          linked: 0,
          message: 'No classified articles found',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${articles.length} classified articles`);

    // Filter out articles that already have entity links
    const articlesNeedingLinks: ArticleRow[] = [];
    for (const article of articles) {
      const { data: existingLinks, error: linkError } = await supabase
        .from('article_entities')
        .select('article_id')
        .eq('article_id', article.id)
        .limit(1)
        .maybeSingle();

      if (linkError) {
        console.error(`Error checking links for ${article.id}: ${linkError.message}`);
        continue;
      }

      if (!existingLinks) {
        articlesNeedingLinks.push(article as ArticleRow);
      }
    }

    console.log(`${articlesNeedingLinks.length} articles need entity extraction`);

    if (articlesNeedingLinks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: articles.length,
          linked: 0,
          message: 'All articles already have entity links',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get OpenAI key for fallback extraction
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    let processed = 0;
    let totalLinked = 0;

    // Process each article
    for (const article of articlesNeedingLinks) {
      try {
        // Extract entities from metadata or use LLM fallback
        let entities = extractEntitiesFromMeta(article.meta);

        if (entities.length === 0 && openaiKey) {
          console.log(`No entities in meta for ${article.id}, using LLM fallback`);
          entities = await extractEntitiesWithLLM(article, openaiKey);
        }

        if (entities.length === 0) {
          console.log(`No entities found for article ${article.id}`);
          processed++;
          continue;
        }

        console.log(`Found ${entities.length} entities for article ${article.id}`);

        let linkedCount = 0;

        // Process each entity
        for (const entity of entities) {
          if (!entity.name || entity.name.length < 2) {
            continue; // Skip very short names
          }

          // Upsert entity
          const entityId = await upsertEntity(supabase, entity.name, entity.type);

          if (!entityId) {
            console.error(`Failed to upsert entity: ${entity.name}`);
            continue;
          }

          // Link article to entity
          const linked = await linkArticleEntity(
            supabase,
            article.id,
            entityId,
            entity.role
          );

          if (linked) {
            linkedCount++;
            totalLinked++;
          }
        }

        console.log(`✓ Linked ${linkedCount} entities to article ${article.id}`);
        processed++;
      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error);
        processed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        linked: totalLinked,
        candidates: articlesNeedingLinks.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Entity extraction failed:', error);

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
