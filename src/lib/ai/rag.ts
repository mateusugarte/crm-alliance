import { createServiceClient } from '@/lib/supabase/service'
import { getOpenAI, EMBEDDING_MODEL } from './openai-client'

export interface KnowledgeChunk {
  id: number
  content: string
  metadata: unknown
}

export async function embedText(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return res.data[0].embedding
}

// RAG lookup against the "documents" knowledge base (hybrid full-text + vector
// search via the `hybrid_search` Postgres function). Used by the "info" and
// "simulacao" tools only — "imoveis" stays a direct table query.
export async function searchKnowledgeBase(query: string, matchCount = 5): Promise<KnowledgeChunk[]> {
  const embedding = await embedText(query)
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('hybrid_search' as never, {
    query_text: query,
    query_embedding: embedding,
    match_count: matchCount,
  } as never)

  if (error) throw new Error(`hybrid_search failed: ${error.message}`)
  return (data ?? []) as KnowledgeChunk[]
}
