/**
 * Briefing comercial de um lead para reativação.
 *
 * Este módulo existe por causa de um achado da simulação contra o banco real:
 * o sistema anterior usava como "ponte" a ÚLTIMA fala útil do lead, e conversas
 * terminam em despedida. O resultado era escolher sistematicamente a pior
 * informação disponível:
 *
 *   Luis      → "certo, muito obrigado por enquanto meu amigo"
 *               (a conversa tinha: "vaga de garagem, conseguiria 2? a unidade
 *                03 é sol da manhã?")
 *   Ana Paula → "Seria de 2 quartos pode ser o mais basico"
 *               (a conversa tinha: "possuo um lote avaliado em R$ 125.000")
 *
 * Aqui as falas do lead são pontuadas por valor comercial e o briefing carrega
 * o melhor fato, não o mais recente.
 */

export type ContextMode = 'conversation' | 'sparse' | 'no_history'

export type LeadAngle =
  | 'objecao'        // o lead adiou ou recuou: reconhecer antes de oferecer
  | 'consultor'      // pediu atendimento humano e não foi atendido
  | 'financiamento'  // perguntou preço, entrada, parcela ou permuta
  | 'unidade'        // discutia uma unidade concreta
  | 'prazo'          // perguntou sobre obra, entrega ou cronograma
  | 'novidade'       // sem contexto: a obra é a notícia

export interface LeadFact {
  /** Fala literal do lead, para a IA usar como evidência. */
  quote: string
  score: number
  angle: LeadAngle
}

export interface LeadBrief {
  eligible: boolean
  exclusionReason: string | null
  mode: ContextMode
  /** Primeiro nome, quando é seguro usar na saudação. */
  safeName: string | null
  /** Melhor fala do lead — a evidência que a mensagem deve ancorar. */
  anchor: LeadFact | null
  /** Ângulo a seguir, derivado do contexto e não de sorteio. */
  angle: LeadAngle
  /** Fatos estruturados extraídos da conversa, em linguagem natural. */
  signals: string[]
  /** Últimas trocas, já limpas, para o modelo consultar. */
  transcript: string[]
}

export interface BriefLead {
  id: string
  name: string | null
  phone: string | null
  stage: string | null
  summary: string | null
  intention: string | null
}

export interface BriefInteraction {
  lead_id: string
  direction: string | null
  sender_type: string | null
  content: string | null
  created_at: string | null
}

/* -------------------------------------------------------------------------
   Higienização
   ---------------------------------------------------------------------- */

const GENERIC_NAME = /^(lead|n[aã]o|teste(?: probe)?|rh|contato|cliente|sem nome|desconhecido)$/i

/** Nomes que denunciam empresa em vez de pessoa.
 *  A simulação pegou "Vc Imobiliários" passando: o padrão antigo exigia
 *  "imobiliária" no singular feminino e não casava com o plural masculino. */
const BUSINESS_NAME = /\b(im[oó]ve(?:l|is)|imobili[aá]ri[oa]s?|corretor(?:a|es)?|construtor[ao]s?|incorporador[ao]s?|neg[oó]cios|registro|cart[oó]rio|vidros|rh|atendimento|comercial|suporte|contabilidade)\b/i

const CANNED_INTEREST = /^ol[aá][!.]? tenho interesse e queria mais informa[cç][oõ]es,? por favor[.!]?$/i
const LOW_SIGNAL = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|sim|n[aã]o|ok|okay|obrigad[oa]|valeu|combinado|entendi|beleza|👍|🙏|🤝)[.! ]*$/i

/** Despedida ou agradecimento: encerra a conversa, não carrega informação. */
const CLOSING = /\b(obrigad[oa]|agrade[cç]o|valeu|at[eé] (?:breve|mais|logo)|por enquanto (?:s[oó]|é s[oó])|abra[cç]os?)\b/i

export function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Extrai o texto legível de uma interação, incluindo os payloads crus do
 *  WhatsApp que chegam como JSON pelo webhook. */
export function readableContent(value: string | null) {
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

export function isInbound(interaction: BriefInteraction) {
  if (interaction.direction === 'inbound') return true
  if (interaction.direction === 'outbound') return false
  return interaction.sender_type === 'lead'
}

export function safeFirstName(value: string | null) {
  const name = normalizeSpaces(value ?? '')
  if (!name || GENERIC_NAME.test(name) || BUSINESS_NAME.test(name) || /\d|@/.test(name)) return null
  const first = name.split(' ')[0]?.replace(/[^\p{L}'-]/gu, '') ?? ''
  if (first.length < 2 || GENERIC_NAME.test(first) || BUSINESS_NAME.test(first)) return null
  return first
}

function isUsefulInbound(value: string) {
  if (!value || CANNED_INTEREST.test(value) || LOW_SIGNAL.test(value)) return false
  if (/^(pode repetir|como posso te chamar|qual (?:e|é) seu nome)/i.test(value)) return false
  return value.replace(/[^\p{L}\p{N}]/gu, '').length >= 12
}

/* -------------------------------------------------------------------------
   Exclusões
   ---------------------------------------------------------------------- */

/**
 * Marcadores de atendente automático / bot de terceiro.
 *
 * A simulação encontrou dois casos reais recebendo campanha: o chatbot de
 * matrículas da Estácio (81 interações de dois robôs conversando entre si) e o
 * atendente automático de uma imobiliária concorrente. Nenhum dos dois é lead.
 */
const THIRD_PARTY_BOT = [
  /\bcanal de atendimento\b/i,
  /\bdigite\s+["“]?\d|\bdigite\s+["“]?(?:sair|menu|voltar)/i,
  /\bhor[aá]rio de (?:atendimento|almo[cç]o)\b/i,
  /\bprotocolo\b.{0,20}\d{4}/i,
  /\b(?:linktr\.ee|bit\.ly)\//i,
  /\b(?:matr[ií]cula|inscri[cç][aã]o|bolsa|vestibular|faculdade|curso)s?\b.{0,60}\b(?:acesse|portal|link)\b/i,
  /\bnosso time\b.{0,40}\b(?:dispon[ií]vel|atender)\b/i,
  /\bseja bem[- ]vindo\(a\)\b/i,
]

function looksLikeThirdPartyBot(name: string | null, inbound: string[]) {
  const text = inbound.join('\n')
  const hits = THIRD_PARTY_BOT.filter(pattern => pattern.test(text)).length
  if (hits >= 2) return true
  // Um marcador forte já basta quando o nome também é de empresa.
  if (hits >= 1 && BUSINESS_NAME.test(normalizeSpaces(name ?? ''))) return true
  // Mensagens idênticas repetidas: assinatura de loop entre dois robôs.
  const unique = new Set(inbound.map(item => item.slice(0, 80)))
  return inbound.length >= 6 && unique.size <= 2
}

/**
 * Motivos para tirar o contato da campanha.
 *
 * A regra de emprego saiu de propósito. Ela procurava `emprego|vaga|currículo`
 * e a simulação flagrou um comprador em negociação ativa sendo descartado como
 * candidato a vaga — a palavra que disparou foi "**vaga** de garagem". Filtrar
 * currículo não é trabalho do disparo: quem manda currículo não vira lead
 * qualificado, e se virar, o custo de uma mensagem é menor que o de perder um
 * comprador.
 */
export function exclusionReason(name: string | null, inbound: string[]): string | null {
  if (/^teste\b/i.test(normalizeSpaces(name ?? ''))) {
    return 'Contato de teste, não deve receber campanha.'
  }
  if (looksLikeThirdPartyBot(name, inbound)) {
    return 'O número é um atendimento automático de outra empresa, não um lead.'
  }
  const text = inbound.join(' \n ')
  if (/\b(n[aã]o tenho|sem|nenhum) interesse\b/i.test(text)) {
    return 'O lead declarou que não tem interesse.'
  }
  if (/\bj[aá] (?:comprei|adquiri|fechei|escolhi)\b.{0,80}\b(outro|outra|apartamento|im[oó]vel)\b/i.test(text)) {
    return 'O lead informou que já comprou outro imóvel.'
  }
  return null
}

/* -------------------------------------------------------------------------
   Pontuação comercial das falas do lead
   ---------------------------------------------------------------------- */

interface SignalRule {
  pattern: RegExp
  score: number
  angle: LeadAngle
  label: string
}

const SIGNAL_RULES: SignalRule[] = [
  // Ativos que o lead declarou possuir são o argumento mais forte que existe.
  { pattern: /\b(?:lote|terreno|permuta|im[oó]vel)\b.{0,40}\b(?:avaliado|vale|no valor|R\$)/i, score: 10, angle: 'financiamento', label: 'tem um bem para dar em permuta ou entrada' },
  { pattern: /\bR\$\s?[\d.]+/i, score: 8, angle: 'financiamento', label: 'falou de valores concretos' },
  { pattern: /\b(?:entrada|financia(?:mento|r)?|parcel(?:a|ar|amento)|conseguiria pagar|or[cç]amento)\b/i, score: 7, angle: 'financiamento', label: 'perguntou sobre condição de pagamento' },

  // Pediu atendimento humano: é o sinal de intenção mais avançado do funil.
  { pattern: /\b(?:falar com|conversar com|contato d[oe])\b.{0,20}\b(?:consultor|corretor|algu[eé]m|voc[eê]s)\b|\bcomo posso ver com eles\b/i, score: 9, angle: 'consultor', label: 'pediu para falar com um consultor' },

  // Unidade concreta: o lead já estava escolhendo.
  { pattern: /\b(?:unidade|apto|apartamento)\s?\d+|\b(?:vaga de garagem|sol da manh[aã]|sol da tarde|planta|metragem|\d+\s?m²|\d+\s?quartos?|su[ií]te|varanda|andar)\b/i, score: 7, angle: 'unidade', label: 'discutia uma unidade específica' },
  { pattern: /\b(?:morar|investir|moradia|investimento)\b/i, score: 4, angle: 'unidade', label: 'declarou a intenção de uso' },

  // Prazo e obra.
  { pattern: /\b(?:prazo|entrega|ficar pronto|cronograma|quando fica|previs[aã]o)\b/i, score: 6, angle: 'prazo', label: 'perguntou sobre prazo de entrega' },

  // Objeção: precisa ser reconhecida antes de qualquer oferta.
  { pattern: /\b(?:mudar de ideia|deixar (?:mais )?pra frente|outra oportunidade|no momento n[aã]o|mais adiante|caro demais|acima do (?:meu )?or[cç]amento|n[aã]o consigo)\b/i, score: 9, angle: 'objecao', label: 'adiou a decisão ou trouxe objeção' },
  { pattern: /\bj[aá] encontrei\b/i, score: 8, angle: 'objecao', label: 'disse que já encontrou outra opção' },
]

function scoreQuote(quote: string): { score: number; angle: LeadAngle; labels: string[] } {
  let score = 0
  let best: { score: number; angle: LeadAngle } = { score: 0, angle: 'novidade' }
  const labels: string[] = []

  for (const rule of SIGNAL_RULES) {
    if (!rule.pattern.test(quote)) continue
    score += rule.score
    labels.push(rule.label)
    if (rule.score > best.score) best = { score: rule.score, angle: rule.angle }
  }

  // Perguntas carregam intenção; despedidas não carregam nada.
  if (quote.includes('?')) score += 2
  if (CLOSING.test(quote) && score <= 2) score -= 6

  return { score, angle: best.angle, labels }
}

/* -------------------------------------------------------------------------
   Montagem do briefing
   ---------------------------------------------------------------------- */

export function buildLeadBrief(lead: BriefLead, interactions: BriefInteraction[]): LeadBrief {
  const deduped = interactions
    .map(interaction => ({ inbound: isInbound(interaction), text: readableContent(interaction.content) }))
    .filter(item => item.text)
    .filter((item, index, all) => (
      index === 0 || item.text !== all[index - 1]?.text || item.inbound !== all[index - 1]?.inbound
    ))

  const inbound = deduped.filter(item => item.inbound).map(item => item.text)
  const usefulInbound = inbound.filter(isUsefulInbound)
  const exclusion = exclusionReason(lead.name, inbound.slice(-8))

  const mode: ContextMode = usefulInbound.length > 0
    ? 'conversation'
    : inbound.length > 0 ? 'sparse' : 'no_history'

  // O melhor fato, não o mais recente. Em empate, o mais recente vence.
  const scored = usefulInbound
    .map((quote, index) => ({ quote, index, ...scoreQuote(quote) }))
    .filter(item => item.score > 0)
    .sort((a, b) => (b.score - a.score) || (b.index - a.index))

  const top = scored[0]
  const anchor: LeadFact | null = top
    ? { quote: top.quote.slice(0, 260), score: top.score, angle: top.angle }
    : null

  const signals = Array.from(new Set(scored.flatMap(item => item.labels))).slice(0, 5)

  // Intenção declarada no CRM entra como sinal quando a conversa não a revelou.
  if (lead.intention && !signals.some(signal => signal.includes('intenção'))) {
    signals.push(`intenção registrada no CRM: ${lead.intention}`)
  }

  return {
    eligible: !exclusion,
    exclusionReason: exclusion,
    mode,
    safeName: safeFirstName(lead.name),
    anchor,
    angle: anchor?.angle ?? 'novidade',
    signals,
    transcript: deduped.slice(-10).map(item => `${item.inbound ? 'Lead' : 'Alliance'}: ${item.text.slice(0, 320)}`),
  }
}
