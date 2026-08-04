interface CommercialSummaryInput {
  summary?: string | null
  shortSummary?: string | null
  city?: string | null
  intention?: 'morar' | 'investir' | null
  propertyInterest?: string | null
  acceptedConsultant?: boolean | null
}

function cleanValue(value?: string | null) {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text || /^(não informado|nao informado|não|nao|brazil)$/i.test(text)) return null
  return text
}

function finishSentence(value: string) {
  const text = value.trim().replace(/[.,;:]+$/, '')
  return text ? `${text}.` : ''
}

function clampAtWord(value: string, max = 330) {
  if (value.length <= max) return value
  const clipped = value.slice(0, max + 1)
  const boundary = clipped.lastIndexOf(' ')
  return `${clipped.slice(0, boundary > max * 0.7 ? boundary : max).trim()}...`
}

function existingSummaryFallback(summary?: string | null) {
  if (!summary) return null
  const cleaned = summary
    .replace(/^Resumo:\s*/i, '')
    .replace(/Lead classificado como [^.]+\.\s*/i, '')
    .replace(/,?\s*com score \d+(?:[.,]\d+)?\/10/gi, '')
    .replace(/Última resposta útil do lead:\s*["“][^"”]*["”]\.*/gi, '')
    .split(/Sinais identificados:|Ponto de atenção:|Ponto de atencao:|Próximo passo sugerido:|Proximo passo sugerido:/i)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

/**
 * Produces a short factual sales snapshot from fields the CRM already owns.
 * It deliberately avoids scores, classifications and invented objections.
 */
export function compactCommercialSummary(input: CommercialSummaryInput) {
  const stored = cleanValue(input.shortSummary)
  if (stored) return clampAtWord(stored)

  const source = input.summary ?? ''
  const property = cleanValue(input.propertyInterest)
  const city = cleanValue(input.city)
  const opening = property
    ? `Busca ${property}${input.intention ? ` para ${input.intention === 'morar' ? 'morar' : 'investir'}` : ''}${city ? ` em ${city}` : ''}`
    : input.intention
      ? `Procura uma oportunidade para ${input.intention === 'morar' ? 'moradia' : 'investimento'}${city ? ` em ${city}` : ''}`
      : `Demonstrou interesse no La Reserva${city ? ` e informou estar em ${city}` : ''}`

  const interests: string[] = []
  if (/preço|preco|valor|tabela|condiç|condic|financi|simulaç|simulac/i.test(source)) interests.push('preços e condições')
  if (/metragem|m²|quarto|planta|unidade|cobertura/i.test(source)) interests.push('plantas e metragens')
  if (/localizaç|localizac|região|regiao/i.test(source)) interests.push('localização')
  if (/obra|prazo|entrega/i.test(source)) interests.push('andamento da obra')

  const detail = interests.length
    ? `Pediu informações sobre ${interests.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' e $1')}`
    : null
  const consultant = input.acceptedConsultant ? 'Aceitou conversar com um consultor' : null
  const final = [finishSentence(opening), detail ? finishSentence(detail) : '', consultant ? finishSentence(consultant) : '']
    .filter(Boolean)
    .join(' ')

  if (detail || property || input.intention || city || input.acceptedConsultant) {
    return clampAtWord(final)
  }

  return clampAtWord(existingSummaryFallback(source) || 'Ainda não há contexto comercial suficiente para resumir este lead.')
}
