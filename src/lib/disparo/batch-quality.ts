export interface BatchMessage {
  lead_id: string
  message: string
  quality_flags: string[]
  approval_status: 'ready' | 'review' | 'blocked'
}

function tokens(value: string) {
  const withoutGreeting = value.replace(/^(?:oi|ol[aá])[,!\s]+[^.!]{0,35}[.!]\s*/i, '')
  return new Set(withoutGreeting
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2))
}

export function messageSimilarity(left: string, right: string) {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection += 1
  return intersection / new Set([...a, ...b]).size
}

export function applyBatchQuality<T extends BatchMessage>(messages: T[], threshold = 0.86): T[] {
  return messages.map((message, index) => {
    if (!message.message || message.approval_status === 'blocked') return message
    const tooSimilar = messages.slice(0, index).some(previous => (
      previous.message && messageSimilarity(previous.message, message.message) >= threshold
    ))
    if (!tooSimilar) return message
    return {
      ...message,
      quality_flags: [...message.quality_flags, 'mensagem_muito_parecida_no_lote'],
      approval_status: 'review' as const,
    }
  })
}
