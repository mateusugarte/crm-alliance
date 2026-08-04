import type OpenAI from 'openai'

export type ReactivationLead = {
  id: string
  name: string | null
  phone: string | null
  stage: string | null
  summary: string | null
  intention: string | null
}

export type ReactivationInteraction = {
  lead_id: string
  direction: string | null
  sender_type: string | null
  content: string | null
  created_at: string | null
}

export type ReactivationContextMode = 'conversation' | 'sparse' | 'no_history'

export type ReactivationGeneration = {
  lead_id: string
  name: string
  phone: string
  message: string
  eligible: boolean
  exclusion_reason: string | null
  context_mode: ReactivationContextMode
  context_reference: string | null
  quality_flags: string[]
}

const GENERIC_NAME = /^(lead|n[aã]o|teste(?: probe)?|rh|contato|cliente|sem nome|desconhecido)$/i
const BUSINESS_NAME = /\b(im[oó]veis|imobili[aá]ria|corretor|construtora|incorporadora|registro|vidros|rh)\b/i
const CANNED_INTEREST = /^ol[aá][!.]? tenho interesse e queria mais informa[cç][oõ]es,? por favor[.!]?$/i
const LOW_SIGNAL = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|sim|n[aã]o|ok|okay|obrigad[oa]|valeu|combinado|entendi|beleza|👍|🙏|🤝)[.! ]*$/i
const FALSE_CONTINUITY = /(desde (?:o )?nosso [uú]ltimo contato|na nossa [uú]ltima conversa|como conversamos|quando falamos|lembrei da nossa conversa)/i

const VARIATION_ANGLES = [
  'Abra com a atualização objetiva da obra e feche com uma pergunta simples.',
  'Use um tom consultivo, ligando o momento do projeto à decisão do lead.',
  'Destaque primeiro o avanço físico da obra; trate valorização como potencial, nunca promessa.',
  'Faça uma retomada curta e humana, com uma única pergunta no final.',
  'Dê protagonismo ao contexto real do lead e use o tema como novidade relevante.',
]

function stableIndex(value: string, modulo: number) {
  let hash = 0
  for (const char of value) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0
  return hash % modulo
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function readableContent(value: string | null) {
  const raw = value?.trim() ?? ''
  if (!raw) return ''
  if (!raw.startsWith('{')) return normalizeSpaces(raw)
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const candidates = [
      parsed.text,
      parsed.conversation,
      (parsed.extendedTextMessage as Record<string, unknown> | undefined)?.text,
      (parsed.message as Record<string, unknown> | undefined)?.conversation,
    ]
    const text = candidates.find(candidate => typeof candidate === 'string')
    return normalizeSpaces(typeof text === 'string' ? text : raw)
  } catch {
    return normalizeSpaces(raw)
  }
}

function isInbound(interaction: ReactivationInteraction) {
  if (interaction.direction === 'inbound') return true
  if (interaction.direction === 'outbound') return false
  return interaction.sender_type === 'lead'
}

function safeFirstName(value: string | null) {
  const name = normalizeSpaces(value ?? '')
  if (!name || GENERIC_NAME.test(name) || BUSINESS_NAME.test(name) || /\d|@/.test(name)) return null
  const first = name.split(' ')[0]?.replace(/[^\p{L}'-]/gu, '') ?? ''
  return first.length >= 2 ? first : null
}

function isUsefulInbound(value: string) {
  if (!value || CANNED_INTEREST.test(value) || LOW_SIGNAL.test(value)) return false
  if (/^(pode repetir|como posso te chamar|qual (?:e|é) seu nome)/i.test(value)) return false
  return value.replace(/[^\p{L}\p{N}]/gu, '').length >= 12
}

function exclusionReason(name: string | null, inboundMessages: string[]) {
  if (/^teste\b/i.test(normalizeSpaces(name ?? ''))) return 'Contato de teste, não deve receber campanha.'
  const text = inboundMessages.join(' \n ')
  if (/\b(n[aã]o tenho|sem) interesse\b/i.test(text)) return 'O lead declarou que não tem interesse.'
  if (/\bj[aá] (?:comprei|adquiri).{0,80}\b(outro|outra)\b/i.test(text)) return 'O lead informou que já comprou outro imóvel.'
  if (/\bfornecedor\b|\bentrega\b.{0,100}\bendere[cç]o\b/i.test(text)) return 'O contato é fornecedor ou tratava de uma entrega.'
  if (/\b(emprego|vaga|curr[ií]culo)\b/i.test(text) && !/\b(im[oó]vel|apartamento|reserva)\b/i.test(text)) {
    return 'A conversa tratava de emprego, não de compra de imóvel.'
  }
  return null
}

function compactSummary(value: string | null) {
  if (!value) return ''
  return normalizeSpaces(value)
    .replace(/^Resumo:\s*/i, '')
    .replace(/Lead classificado como [^.]+\.\s*/i, '')
    .slice(0, 600)
}

function sanitizeMessage(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^['"“]|['"”]$/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseModelMessage(value: string) {
  const raw = value.trim()
  try {
    const parsed = JSON.parse(raw) as { message?: unknown }
    if (typeof parsed.message === 'string') return sanitizeMessage(parsed.message)
  } catch {
    // Some providers can ignore JSON mode during transient fallbacks.
  }
  return sanitizeMessage(raw)
}

function qualityFlags(message: string, mode: ReactivationContextMode, safeName: string | null) {
  const flags: string[] = []
  if (message.length < 120) flags.push('mensagem_curta_demais')
  if (message.length > 650) flags.push('mensagem_longa_demais')
  if (mode !== 'conversation' && FALSE_CONTINUITY.test(message)) flags.push('continuidade_sem_evidencia')
  if (/valorização (?:garantida|certa)|garantia de valorização/i.test(message)) flags.push('promessa_de_valorizacao')
  if (!safeName && /^(oi|ol[aá]),?\s+(lead|n[aã]o|teste|rh)\b/i.test(message)) flags.push('saudacao_com_nome_invalido')
  if ((message.match(/\?/g) ?? []).length > 1) flags.push('perguntas_em_excesso')
  if (!message.endsWith('?')) flags.push('sem_cta_claro')
  return flags
}

function buildContext(lead: ReactivationLead, interactions: ReactivationInteraction[]) {
  const deduped = interactions
    .map(interaction => ({ ...interaction, readable: readableContent(interaction.content) }))
    .filter(interaction => interaction.readable)
    .filter((interaction, index, all) => (
      index === 0
      || interaction.readable !== all[index - 1]?.readable
      || isInbound(interaction) !== isInbound(all[index - 1]!)
    ))

  const inbound = deduped.filter(isInbound).map(interaction => interaction.readable)
  const usefulInbound = inbound.filter(isUsefulInbound)
  const exclusion = exclusionReason(lead.name, inbound.slice(-5))
  const mode: ReactivationContextMode = usefulInbound.length > 0
    ? 'conversation'
    : inbound.length > 0
      ? 'sparse'
      : 'no_history'
  const reference = usefulInbound.at(-1) ?? null
  const safeName = safeFirstName(lead.name)
  const conversation = deduped.slice(-12).map(interaction => (
    `${isInbound(interaction) ? 'Lead' : 'Alliance'}: ${interaction.readable.slice(0, 500)}`
  )).join('\n')

  return { exclusion, mode, reference, safeName, conversation }
}

export function analyzeReactivationContext(
  lead: ReactivationLead,
  interactions: ReactivationInteraction[],
) {
  const context = buildContext(lead, interactions)
  return {
    eligible: !context.exclusion,
    exclusionReason: context.exclusion,
    mode: context.mode,
    reference: context.reference,
    safeName: context.safeName,
  }
}

function buildPrompt(
  lead: ReactivationLead,
  campaignTheme: string,
  manualContext: string,
  context: ReturnType<typeof buildContext>,
  corrections: string[] = [],
) {
  const modeGuidance = context.mode === 'conversation'
    ? `Existe conversa comercial útil. Use no máximo UM fato real dela como ponte, sem repetir falas literalmente. A última fala útil foi: "${context.reference}".`
    : context.mode === 'sparse'
      ? 'Houve apenas saudação, resposta automática ou fala sem valor comercial. Não finja intimidade nem cite uma conversa anterior.'
      : 'Não existe conversa recebida do lead. Apresente a atualização como um novo contato e não use "último contato", "como conversamos" ou equivalentes.'

  return `Crie uma mensagem individual de reativação para WhatsApp em português brasileiro.

TEMA E FATOS DA CAMPANHA (direção, não texto para copiar):
"""
${campaignTheme}
"""

DADOS CONFIÁVEIS:
- Nome permitido na saudação: ${context.safeName ?? '(não usar nome na saudação)'}
- Etapa atual: ${lead.stage ?? 'não informada'}
- Intenção declarada: ${lead.intention ?? 'não informada'}
- Modo de contexto: ${context.mode}
- Resumo do CRM, apenas como evidência secundária: ${compactSummary(lead.summary) || '(sem resumo confiável)'}
- Contexto manual do corretor: ${manualContext || '(nenhum)'}

HISTÓRICO, EM ORDEM:
${context.conversation || '(sem histórico de conversa)'}

REGRA DE CONTEXTO:
${modeGuidance}

VARIAÇÃO DE ESTILO DESTA PESSOA:
${VARIATION_ANGLES[stableIndex(lead.id, VARIATION_ANGLES.length)]}

REGRAS OBRIGATÓRIAS:
- Preserve os fatos do tema, mas reescreva com naturalidade.
- Use de 2 a 3 blocos curtos e aproximadamente 220 a 520 caracteres.
- Termine com UMA pergunta fácil de responder.
- Se houver contexto comercial útil, personalize com apenas um fato comprovado.
- Não invente preferência, orçamento, relacionamento ou conversa.
- Não prometa valorização; fale em potencial ou oportunidade.
- Não use emoji, linguagem de robô, excesso de entusiasmo ou pressão.
- Não diga "estou aqui para te ajudar a tomar a melhor decisão".
- Não use o nome quando ele estiver marcado como inválido.
${corrections.length ? `- Corrija obrigatoriamente estes problemas da tentativa anterior: ${corrections.join(', ')}.` : ''}

Responda em JSON válido no formato {"message":"texto final"}.`
}

export async function generateReactivationMessage(input: {
  openai: OpenAI
  lead: ReactivationLead
  interactions: ReactivationInteraction[]
  campaignTheme: string
  manualContext?: string
}): Promise<ReactivationGeneration> {
  const context = buildContext(input.lead, input.interactions)
  const base = {
    lead_id: input.lead.id,
    name: input.lead.name ?? '',
    phone: input.lead.phone ?? '',
    context_mode: context.mode,
    context_reference: context.reference,
  }

  if (context.exclusion) {
    return {
      ...base,
      message: '',
      eligible: false,
      exclusion_reason: context.exclusion,
      quality_flags: ['lead_incompativel_com_reativacao'],
    }
  }

  let message = ''
  let flags: string[] = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await input.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você escreve mensagens comerciais humanas, factuais e breves. Nunca invente contexto. Cumpra o JSON solicitado.',
        },
        {
          role: 'user',
          content: buildPrompt(input.lead, input.campaignTheme, input.manualContext?.trim() ?? '', context, flags),
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.72,
    })
    message = parseModelMessage(completion.choices[0]?.message?.content ?? '')
    flags = qualityFlags(message, context.mode, context.safeName)
    if (!flags.length) break
  }

  return {
    ...base,
    message: flags.length ? '' : message,
    eligible: true,
    exclusion_reason: null,
    quality_flags: flags,
  }
}
