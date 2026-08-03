const GENERIC_NAME_TOKENS = new Set([
  'lead',
  'cliente',
  'contato',
  'whatsapp',
  'zap',
  'novo',
  'nova',
  'sem',
  'nome',
  'desconhecido',
  'desconhecida',
  'dr',
  'dra',
  'sr',
  'sra',
  'vip',
  'crm',
  'null',
  'undefined',
  'none',
])

const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function stripLeadNameEmoji(input: string) {
  return input
    .normalize('NFKC')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ' ')
}

function titleWord(word: string) {
  return word
    .toLocaleLowerCase('pt-BR')
    .split(/([-'])/)
    .map(part => {
      if (part === '-' || part === "'") return part
      return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1)
    })
    .join('')
}

export function normalizeLeadName(input: string | null | undefined, fallback = 'Lead') {
  const cleaned = stripLeadNameEmoji(input ?? '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
    .replace(/@s\.whatsapp\.net/gi, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')

  const words = cleaned.match(/[\p{L}][\p{L}'-]*/gu) ?? []
  const candidates = words
    .map(word => word.replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .filter(word => !GENERIC_NAME_TOKENS.has(word.toLocaleLowerCase('pt-BR')))

  const significant = candidates.filter(word => !NAME_PARTICLES.has(word.toLocaleLowerCase('pt-BR')))
  const source = significant.length ? significant : candidates
  const selected = source.length >= 2 ? [source[0], source[source.length - 1]] : source.slice(0, 1)

  return selected.map(titleWord).join(' ').trim() || fallback
}
