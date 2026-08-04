/**
 * Mensagens do WhatsApp (UazAPI → n8n → CRM) nem sempre chegam como texto puro:
 * quando o lead responde citando outra mensagem, ou entra por anúncio
 * (Click-to-WhatsApp / FB_Ads), o payload cru vem serializado como JSON —
 * `{"text":"...","contextInfo":{...}}` — carregando stanzaID, dados de conversão
 * e até thumbnail base64. Guardar isso em `interactions.content` polui o chat do
 * corretor, queima tokens da Alice e aparece como lixo na tela /interacoes.
 *
 * Quando o n8n agrupa várias mensagens em uma só (buffer), o conteúdo vira uma
 * concatenação de blobs JSON e trechos de texto puro — por isso o parser varre a
 * string inteira em vez de tentar um único `JSON.parse`.
 *
 * Regra importante: `contextInfo.quotedMessage` NUNCA é usado como fonte de
 * texto — é a mensagem anterior (normalmente da própria Alice), não o que o lead
 * escreveu.
 */

// Campos que carregam o texto real da mensagem
const TEXT_KEYS = ['text', 'conversation', 'caption', 'body', 'selectedDisplayText'] as const

// Envelopes conhecidos do WhatsApp que embrulham o texto um nível abaixo
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
] as const

const MAX_DEPTH = 5

function decodePercentEncoding(text: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return text
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function textFromObject(obj: Record<string, unknown>, depth = 0): string {
  for (const key of TEXT_KEYS) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  if (depth >= MAX_DEPTH) return ''

  for (const key of NESTED_KEYS) {
    const value = obj[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = textFromObject(value as Record<string, unknown>, depth + 1)
      if (nested) return nested
    }
  }

  return ''
}

/** Índice do `}` que fecha o objeto aberto em `start`, ignorando chaves dentro de strings. */
function findObjectEnd(raw: string, start: number): number {
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

/**
 * Devolve o texto legível de uma mensagem, seja ela texto puro, um payload cru
 * do WhatsApp ou uma mistura dos dois. Se nada de aproveitável for encontrado,
 * devolve a entrada original — melhor mostrar o JSON do que uma bolha vazia.
 */
export function extractMessageText(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed.includes('{')) return decodePercentEncoding(trimmed)

  const parts: string[] = []
  let cursor = 0
  let index = trimmed.indexOf('{')

  while (index !== -1) {
    const end = findObjectEnd(trimmed, index)
    let parsed: unknown = null

    if (end !== -1) {
      try {
        parsed = JSON.parse(trimmed.slice(index, end + 1))
      } catch {
        parsed = null
      }
    }

    // Não era JSON válido (ex: o lead escreveu "{" no meio da frase) — segue adiante
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      index = trimmed.indexOf('{', index + 1)
      continue
    }

    const before = trimmed.slice(cursor, index).trim()
    if (before) parts.push(before)

    const text = textFromObject(parsed as Record<string, unknown>)
    if (text) parts.push(text)

    cursor = (end as number) + 1
    index = trimmed.indexOf('{', cursor)
  }

  const tail = trimmed.slice(cursor).trim()
  if (tail) parts.push(tail)

  return decodePercentEncoding(parts.join(' ').trim() || trimmed)
}
