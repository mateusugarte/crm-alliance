/**
 * Limpa interactions.content que foram gravados como payload cru do WhatsApp
 * (`{"text":"...","contextInfo":{...}}`, inclusive vários blobs concatenados
 * quando o n8n agrupa mensagens).
 *
 * A lógica de extração espelha src/lib/whatsapp/extract-message-text.ts —
 * qualquer ajuste lá deve ser refletido aqui.
 *
 * Uso:
 *   DATABASE_URL=... node scripts/clean-interaction-json-content.mjs           # dry-run
 *   DATABASE_URL=... APPLY=1 node scripts/clean-interaction-json-content.mjs   # grava
 *
 * Requer a tabela de auditoria de 022_interaction_content_cleanup_audit.sql.
 */
import pg from 'pg'

const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.PG_MEMORY_URL
const APPLY = process.env.APPLY === '1'
const CLEANED_BY = 'extract_message_text_v1'

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

// ── extração (espelho de src/lib/whatsapp/extract-message-text.ts) ───────────

const TEXT_KEYS = ['text', 'conversation', 'caption', 'body', 'selectedDisplayText']

const NESTED_KEYS = [
  'message',
  'extendedTextMessage',
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'documentWithCaptionMessage',
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'buttonsResponseMessage',
  'templateButtonReplyMessage',
  'listResponseMessage',
]

const MAX_DEPTH = 5

function decodePercentEncoding(text) {
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return text
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function textFromObject(obj, depth = 0) {
  for (const key of TEXT_KEYS) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  if (depth >= MAX_DEPTH) return ''

  for (const key of NESTED_KEYS) {
    const value = obj[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = textFromObject(value, depth + 1)
      if (nested) return nested
    }
  }

  return ''
}

function findObjectEnd(raw, start) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < raw.length; i++) {
    const char = raw[i]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return i
  }

  return -1
}

function extractMessageText(raw) {
  const trimmed = (raw ?? '').trim()
  if (!trimmed.includes('{')) return decodePercentEncoding(trimmed)

  const parts = []
  let cursor = 0
  let index = trimmed.indexOf('{')

  while (index !== -1) {
    const end = findObjectEnd(trimmed, index)
    let parsed = null

    if (end !== -1) {
      try {
        parsed = JSON.parse(trimmed.slice(index, end + 1))
      } catch {
        parsed = null
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      index = trimmed.indexOf('{', index + 1)
      continue
    }

    const before = trimmed.slice(cursor, index).trim()
    if (before) parts.push(before)

    const text = textFromObject(parsed)
    if (text) parts.push(text)

    cursor = end + 1
    index = trimmed.indexOf('{', cursor)
  }

  const tail = trimmed.slice(cursor).trim()
  if (tail) parts.push(tail)

  return decodePercentEncoding(parts.join(' ').trim() || trimmed)
}

// ── execução ─────────────────────────────────────────────────────────────────

const preview = value => value.replace(/\s+/g, ' ').slice(0, 110)

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const { rows } = await client.query(`
      select id, content, created_at
      from public.interactions
      where content like '%{%'
      order by created_at
    `)

    const changes = []
    const untouched = []

    for (const row of rows) {
      const cleaned = extractMessageText(row.content)
      if (cleaned && cleaned !== row.content) changes.push({ ...row, cleaned })
      else untouched.push(row)
    }

    console.log(`linhas com "{" no content: ${rows.length}`)
    console.log(`a limpar: ${changes.length} | sem alteração: ${untouched.length}`)
    console.log(APPLY ? '\nMODO: APPLY (grava no banco)\n' : '\nMODO: dry-run (nada é gravado)\n')

    for (const change of changes) {
      console.log(`· ${change.id} ${change.created_at.toISOString()}`)
      console.log(`  antes:  ${preview(change.content)}`)
      console.log(`  depois: ${preview(change.cleaned)}`)
    }

    if (untouched.length) {
      console.log(`\nnão alteradas (nenhum texto extraível ou já limpas): ${untouched.length}`)
      for (const row of untouched.slice(0, 10)) {
        console.log(`· ${row.id} ${preview(row.content)}`)
      }
    }

    if (!APPLY || changes.length === 0) {
      console.log('\nNada gravado. Rode com APPLY=1 para aplicar.')
      return
    }

    await client.query('begin')
    try {
      for (const change of changes) {
        await client.query(
          `insert into public.interaction_content_cleanup_audit
             (interaction_id, old_content, new_content, cleaned_by)
           values ($1, $2, $3, $4)`,
          [change.id, change.content, change.cleaned, CLEANED_BY]
        )
        await client.query(
          'update public.interactions set content = $2 where id = $1',
          [change.id, change.cleaned]
        )
      }
      await client.query('commit')
      console.log(`\n${changes.length} interações limpas (originais salvos em interaction_content_cleanup_audit).`)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  } finally {
    await client.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
