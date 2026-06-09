import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.PG_MEMORY_URL,
})

function cleanPhone(raw: string): string {
  return raw.replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

export async function recordDispatchToMemory(phone: string, content: string): Promise<void> {
  if (!process.env.PG_MEMORY_URL) return
  const sessionId = `la_reserva_${cleanPhone(phone)}`
  const message   = JSON.stringify({ type: 'ai', content })
  await pool.query(
    'INSERT INTO n8n_chat_histories (session_id, message) VALUES ($1, $2)',
    [sessionId, message],
  )
}
