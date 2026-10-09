import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

function matches(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Aceita o segredo do N8N ou a chave service role do Supabase, que a
 * credencial Supabase do N8N envia no header apikey.
 */
export function authorizeN8N(request: NextRequest) {
  return matches(request.headers.get('x-webhook-secret'), process.env.N8N_WEBHOOK_SECRET)
    || matches(request.headers.get('apikey'), process.env.SUPABASE_SERVICE_ROLE_KEY)
}
