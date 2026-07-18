import OpenAI from 'openai'

// Lazy singleton: avoids throwing at module-load time (e.g. during `next build`'s
// page-data collection, when OPENAI_API_KEY may not be injected yet).
let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export const CHAT_MODEL = process.env.OPENAI_MODEL_ALICE || 'gpt-4.1-mini'
export const EMBEDDING_MODEL = 'text-embedding-3-small'
