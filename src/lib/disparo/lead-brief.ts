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

export type AudienceType =
  | 'buyer'
  | 'supplier'
  | 'partner'
  | 'job_seeker'
  | 'third_party_bot'
  | 'test'
  | 'not_interested'
  | 'unknown'

export interface AudienceAssessment {
  type: AudienceType
  status: 'eligible' | 'review' | 'blocked'
  confidence: number
  reasons: string[]
}

export type CommercialFactKind =
  | 'intent'
  | 'unit'
  | 'financing'
  | 'budget'
  | 'timeline'
  | 'objection'
  | 'human_contact'

export interface CommercialFact {
  id: string
  kind: CommercialFactKind
  /** Rótulo comercial controlado. Nunca contém a fala crua do lead. */
  value: string
  source: 'lead_message' | 'crm'
  source_at: string | null
  /** Evidência para auditoria humana. Este campo nunca vai para o prompt. */
  quote: string | null
  safe_for_copy: boolean
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
  audience: AudienceAssessment
  facts: CommercialFact[]
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

function textFromPayload(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const candidates = [
      parsed.text,
      parsed.conversation,
      (parsed.extendedTextMessage as Record<string, unknown> | undefined)?.text,
      (parsed.message as Record<string, unknown> | undefined)?.conversation,
    ]
    const text = candidates.find(candidate => typeof candidate === 'string')
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

/**
 * Extrai o texto legível de uma interação.
 *
 * O webhook grava o payload cru do WhatsApp, e às vezes grava DOIS objetos JSON
 * concatenados na mesma linha. `JSON.parse` falha no conjunto e o texto inteiro
 * — chaves, `previewType`, `contextInfo` — ia parar dentro do prompt e, de lá,
 * dentro da mensagem enviada ao cliente. Agora cada objeto é lido em separado.
 */
export function readableContent(value: string | null) {
  const raw = value?.trim() ?? ''
  if (!raw) return ''
  if (!raw.startsWith('{')) return normalizeSpaces(raw)

  const direct = textFromPayload(raw)
  if (direct !== null) return normalizeSpaces(direct)

  // Varre objetos JSON balanceados grudados na mesma string.
  const parts: string[] = []
  let depth = 0
  let start = -1
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        const text = textFromPayload(raw.slice(start, index + 1))
        if (text) parts.push(text)
        start = -1
      }
    }
  }

  return normalizeSpaces(parts.length ? parts.join(' ') : raw)
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
  /\bdigit(?:e|ar|ando)\s+["“]?(?:\d|sair|menu|voltar|op[cç][aã]o)/i,
  /\bhor[aá]rio de (?:atendimento|almo[cç]o|funcionamento)\b/i,
  /\bprotocolo\b.{0,20}\d{4}/i,
  /\b(?:linktr\.ee|bit\.ly)\//i,
  /\b(?:matr[ií]cula|inscri[cç][aã]o|bolsa|vestibular|faculdade|curso)s?\b.{0,80}\b(?:acesse|portal|link|https?:)/i,
  /\bnosso time\b.{0,40}\b(?:dispon[ií]vel|atender)\b/i,
  /\bseja bem[- ]vindo(?:\(a\)|a)?\b.{0,40}\b(?:ao|nosso|mundo)\b/i,
  /\bbem[- ]vindo\b.{0,20}\bao mundo\b/i,
  /\b(?:um|nosso) (?:corretor|consultor|especialista|atendente)\b.{0,40}\b(?:ir[aá] lhe ligar|entrar[aá] em contato)\b/i,
  /\bagradecemos sua mensagem\b.{0,100}\bn[aã]o estamos dispon[ií]veis\b/i,
]

/** Assinaturas de terceiros específicas o bastante para um único acerto bastar. */
const STRONG_THIRD_PARTY_BOT = [
  /\b(?:assistente virtual|intelig[eê]ncia artificial) da UNIASSELVI\b/i,
  /\bassistente virtual da PUCRS\b/i,
  /\bbem[- ]vindo ao mundo Est[aá]cio\b/i,
  /\bA Decolar te aguarda\b/i,
  /\bConcession[aá]ria Honda\b/i,
  /\bempresa ProHair\b/i,
  /\bWhatsApp (?:é )?utilizado exclusivamente para o envio de informa[cç][oõ]es\b/i,
  /\bestamos com um novo n[uú]mero\b.{0,100}\bwa\.me\/message\b/i,
]

/**
 * Uma broadcast de marketing de outra empresa não é lead.
 *
 * A amostra do banco trouxe dois casos reais recebendo campanha: o robô de
 * matrículas da Estácio (dezenas de interações de dois bots conversando entre
 * si) e o atendente automático de uma imobiliária concorrente.
 */
function looksLikeThirdPartyBot(name: string | null, inbound: string[]) {
  const text = inbound.join('\n')
  if (STRONG_THIRD_PARTY_BOT.some(pattern => pattern.test(text))) return true
  const hits = THIRD_PARTY_BOT.filter(pattern => pattern.test(text)).length
  if (hits >= 2) return true
  // Um marcador forte já basta quando o nome também é de empresa.
  if (hits >= 1 && BUSINESS_NAME.test(normalizeSpaces(name ?? ''))) return true

  // Repetição literal de mensagem longa: pessoa não reenvia o mesmo texto de
  // 100+ caracteres várias vezes; robô em loop, sim. Sozinho já é conclusivo.
  const longMessages = inbound.filter(item => item.length >= 100).map(item => item.slice(0, 120))
  const repeats = new Map<string, number>()
  for (const item of longMessages) repeats.set(item, (repeats.get(item) ?? 0) + 1)
  if ([...repeats.values()].some(count => count >= 3)) return true

  // Um marcador somado a conversa que nunca varia também fecha o diagnóstico.
  const unique = new Set(inbound.map(item => item.slice(0, 80)))
  return hits >= 1 && inbound.length >= 4 && unique.size <= 2
}

/**
 * Quem quer VENDER para a obra, não comprar nela.
 *
 * Caso real do banco: Arthur Franco pediu "participar das cotações para
 * execução de serviços" e listou escopo de elétrica, automação, SPDA e
 * fotovoltaica. Estava marcado como lead_quente e receberia uma campanha
 * perguntando se quer agendar visita ao apartamento.
 */
const SUPPLIER = [
  /\b(?:cota[cç][aã]o|cota[cç][oõ]es|or[cç]amento)\b.{0,60}\b(?:servi[cç]os?|obra|execu[cç][aã]o|fornecimento)\b/i,
  /\bescopo\b.{0,80}\b(?:el[eé]trica|automa[cç][aã]o|hidr[aá]ulica|estrutural|alvenaria|instala[cç][oõ]es)\b/i,
  /\b(?:sou|somos)\b.{0,50}\b(?:fornecedor|representante|empreiteir[ao]|prestador(?:a)? de servi[cç]o|consultor(?:a)? t[eé]cnico|t[eé]cnico comercial|vendedor(?:a)?)\b/i,
  /\b(?:prestar|executar|fornecer)\b.{0,40}\b(?:servi[cç]os?|material|materiais)\b.{0,30}\b(?:na |para a |da )?obra\b/i,
  /\b(?:parceria comercial|portf[oó]lio de servi[cç]os|apresentar (?:nossa )?empresa)\b/i,
  // "Trabalho com locação de escoramento metálico" e "trabalho com imagens
  // aéreas com drone": quem se apresenta pelo próprio ramo está oferecendo,
  // não comprando.
  /\btrabalho com\b.{0,50}\b(?:loca[cç][aã]o|servi[cç]os?|equipamentos?|materiais|imagens|drone|escoramento|andaimes?|constru[cç][aã]o)\b/i,
  /\bapresentar\b.{0,40}\b(?:meu trabalho|meus servi[cç]os|nossos servi[cç]os|nossa empresa|portf[oó]lio)\b/i,
  /\btabela de (?:servi[cç]os|pre[cç]os de servi[cç]o)\b/i,
  /\bproposta de (?:valores|pre[cç]os)\b.{0,50}\b(?:loca[cç][aã]o|servi[cç]o|fornecimento|aluguel)\b/i,
  /\bloca[cç][aã]o d[eo]\b.{0,40}\b(?:equipamentos?|escoramento|andaimes?|m[aá]quinas?|containers?|f[oô]rmas?)\b/i,
]

/** Intenções não comerciais com padrões estreitos para evitar "vaga de garagem". */
const JOB_SEEKER = [
  /\b(?:enviar|encaminhar|deixar)\b.{0,30}\b(?:meu )?(?:curr[ií]culo|curriculum)\b/i,
  /\b(?:vaga|oportunidade) de emprego\b/i,
  /\b(?:voc[eê]s|a empresa) (?:est[aã]o|est[aá]) contratando\b/i,
  /\b(?:gostaria|quero|tenho interesse)\b.{0,50}\btrabalhar (?:na|com a|com voc[eê]s)\b/i,
]

const COMMERCIAL_PARTNER = [
  /\b(?:proposta|oportunidade) de parceria\b|\bparceria comercial\b/i,
  /\boferecer im[oó]veis para voc[eê]s constru[ií]rem\b/i,
  /\bsetor de incorpora[cç][aã]o\b.{0,100}\b(?:ofertar|oportunidades?|terrenos?)\b/i,
  /\b(?:imobili[aá]ria|sou corretor)\b.{0,100}\b(?:presta[cç][aã]o de servi[cç]os?|trabalhar com o empreendimento|vender o empreendimento)\b/i,
]

export function exclusionReason(name: string | null, inbound: string[]): string | null {
  if (/^teste\b/i.test(normalizeSpaces(name ?? ''))) {
    return 'Contato de teste, não deve receber campanha.'
  }
  if (looksLikeThirdPartyBot(name, inbound)) {
    return 'O número é um atendimento automático de outra empresa, não um lead.'
  }
  if (SUPPLIER.some(rule => rule.test(inbound.join('\n')))) {
    return 'O contato quer prestar serviço para a obra, não comprar uma unidade.'
  }
  if (JOB_SEEKER.some(rule => rule.test(inbound.join('\n')))) {
    return 'O contato procura emprego, não uma unidade do empreendimento.'
  }
  if (COMMERCIAL_PARTNER.some(rule => rule.test(inbound.join('\n')))) {
    return 'O contato propõe parceria comercial, não a compra de uma unidade.'
  }
  const refusal = /\b(n[aã]o tenho|sem|nenhum) interesse\b/i
  const purchased = /\bj[aá] (?:comprei|adquiri|fechei|escolhi)\b.{0,80}\b(outro|outra|apartamento|im[oó]vel)\b/i

  /**
   * A recusa só vale se for a última palavra do lead sobre o assunto.
   *
   * A auditoria contra o banco pegou um caso real: o Romário abriu com "no
   * momento não tenho interesse" e, nas mensagens seguintes, perguntou sobre
   * financiamento e disse que precisava de um apartamento entre 300 e 350 mil.
   * Ele não é um lead perdido — é um lead com faixa de preço definida. Excluir
   * pela mensagem mais antiga descarta quem voltou a conversar.
   */
  const lastRefusal = inbound.findLastIndex(message => refusal.test(message) || purchased.test(message))
  if (lastRefusal >= 0) {
    const reengaged = inbound
      .slice(lastRefusal + 1)
      .some(message => SIGNAL_RULES.some(rule => rule.pattern.test(message)))
    if (!reengaged) {
      return purchased.test(inbound[lastRefusal]!)
        ? 'O lead informou que já comprou outro imóvel.'
        : 'O lead declarou que não tem interesse.'
    }
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
  kind: CommercialFactKind
  safeForCopy: boolean
}

const SIGNAL_RULES: SignalRule[] = [
  // Ativos que o lead declarou possuir são o argumento mais forte que existe.
  { pattern: /\b(?:lote|terreno|permuta|im[oó]vel)\b.{0,40}\b(?:avaliado|vale|no valor|R\$)/i, score: 10, angle: 'financiamento', label: 'considerou usar um bem como entrada ou permuta', kind: 'financing', safeForCopy: true },
  { pattern: /\bR\$\s?[\d.]+/i, score: 8, angle: 'financiamento', label: 'conversou sobre uma faixa de investimento', kind: 'budget', safeForCopy: false },
  { pattern: /\b(?:entrada|financia(?:mento|r)?|parcel(?:a|ar|amento)|conseguiria pagar|or[cç]amento)\b/i, score: 7, angle: 'financiamento', label: 'demonstrou interesse nas condições de pagamento', kind: 'financing', safeForCopy: true },
  // Pergunta de preço é o sinal comercial mais comum e não estava coberto:
  // "Qual o valor do apartamento?" caía como conversa sem sinal nenhum.
  { pattern: /\b(?:qual|quanto)\b.{0,30}\b(?:valor|pre[cç]o|custa|fica|sai)\b|\bvalor(?:es)? d[oae]\b|\bpre[cç]o d[oae]\b|\btabela de pre[cç]os?\b/i, score: 6, angle: 'financiamento', label: 'demonstrou interesse em valores e condições', kind: 'financing', safeForCopy: true },

  // Pediu atendimento humano: é o sinal de intenção mais avançado do funil.
  { pattern: /\b(?:falar com|conversar com|contato d[oe])\b.{0,20}\b(?:consultor|corretor|algu[eé]m|voc[eê]s)\b|\bcomo posso ver com eles\b/i, score: 9, angle: 'consultor', label: 'demonstrou abertura para falar com um consultor', kind: 'human_contact', safeForCopy: true },

  // Unidade concreta: o lead já estava escolhendo.
  { pattern: /\b(?:unidade|apto|apartamento)\s?\d+|\b(?:vaga de garagem|sol da manh[aã]|sol da tarde|planta|metragem|\d+\s?m²|\d+\s?quartos?|su[ií]te|varanda|andar)\b/i, score: 7, angle: 'unidade', label: 'avaliou características de uma unidade', kind: 'unit', safeForCopy: true },
  { pattern: /\b(?:morar|investir|moradia|investimento)\b/i, score: 4, angle: 'unidade', label: 'indicou a finalidade do imóvel', kind: 'intent', safeForCopy: true },

  // Prazo e obra.
  { pattern: /\b(?:prazo|entrega|ficar pronto|cronograma|quando fica|previs[aã]o)\b/i, score: 6, angle: 'prazo', label: 'demonstrou interesse no andamento e no prazo da obra', kind: 'timeline', safeForCopy: true },

  // Objeção: precisa ser reconhecida antes de qualquer oferta.
  { pattern: /\b(?:mudar de ideia|deixar (?:mais )?pra frente|outra oportunidade|no momento n[aã]o|mais adiante|caro demais|acima do (?:meu )?or[cç]amento|n[aã]o consigo)\b/i, score: 9, angle: 'objecao', label: 'adiou a decisão ou apresentou uma objeção', kind: 'objection', safeForCopy: true },
  { pattern: /\bj[aá] encontrei\b/i, score: 8, angle: 'objecao', label: 'indicou que avaliou outra opção', kind: 'objection', safeForCopy: true },
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
    .map(interaction => ({
      inbound: isInbound(interaction),
      text: readableContent(interaction.content),
      createdAt: interaction.created_at,
    }))
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
  //
  // Exige pelo menos UM sinal comercial reconhecido (`labels`), não só a
  // pontuação: uma frase ganha +2 só por ter interrogação, e "Para moradia
  // mesmo?" não é contexto suficiente para personalizar coisa alguma. Sem
  // sinal, o lead segue para o texto da campanha em vez de virar uma
  // personalização fabricada.
  const scored = usefulInbound
    .map((quote, index) => ({ quote, index, ...scoreQuote(quote) }))
    .filter(item => item.score > 0 && item.labels.length > 0)
    .sort((a, b) => (b.score - a.score) || (b.index - a.index))

  const top = scored[0]
  const anchor: LeadFact | null = top
    ? { quote: top.quote.slice(0, 260), score: top.score, angle: top.angle }
    : null

  const collected = Array.from(new Set(scored.flatMap(item => item.labels)))

  const facts: CommercialFact[] = []
  for (const [messageIndex, item] of deduped.entries()) {
    if (!item.inbound || !isUsefulInbound(item.text)) continue
    for (const [ruleIndex, rule] of SIGNAL_RULES.entries()) {
      if (!rule.pattern.test(item.text)) continue
      facts.push({
        id: `lead-${lead.id}-${messageIndex}-${ruleIndex}`,
        kind: rule.kind,
        value: rule.label,
        source: 'lead_message',
        source_at: item.createdAt,
        quote: item.text.slice(0, 260),
        safe_for_copy: rule.safeForCopy,
        score: rule.score,
        angle: rule.angle,
      })
    }
  }

  // Intenção declarada no CRM entra como sinal quando a conversa não a revelou.
  if (lead.intention && !collected.some(signal => signal.includes('intenção'))) {
    collected.push(`intenção registrada no CRM: ${lead.intention}`)
    facts.push({
      id: `crm-${lead.id}-intention`,
      kind: 'intent',
      value: `finalidade registrada: ${normalizeSpaces(lead.intention).slice(0, 80)}`,
      source: 'crm',
      source_at: null,
      quote: null,
      safe_for_copy: !/\d|R\$/i.test(lead.intention),
      score: 3,
      angle: 'unidade',
    })
  }
  const signals = collected.slice(0, 5)

  const blockedType: AudienceType | null = lead.stage === 'fornecedores'
    ? 'supplier'
    : exclusion?.includes('atendimento automático') ? 'third_party_bot'
      : exclusion?.includes('prestar serviço') ? 'supplier'
        : exclusion?.includes('emprego') ? 'job_seeker'
          : exclusion?.includes('parceria') ? 'partner'
            : exclusion?.includes('teste') ? 'test'
              : exclusion ? 'not_interested' : null

  const hasBuyerSignal = facts.length > 0
    || inbound.some(message => CANNED_INTEREST.test(message))
    || ['lead_morno', 'lead_quente', 'reuniao_agendada', 'follow_up', 'venda_confirmada'].includes(lead.stage ?? '')

  const audience: AudienceAssessment = blockedType
    ? {
        type: blockedType,
        status: 'blocked',
        confidence: lead.stage === 'fornecedores' ? 1 : 0.98,
        reasons: [exclusion ?? 'Contato classificado fora do público comprador.'],
      }
    : hasBuyerSignal
      ? {
          type: 'buyer',
          status: 'eligible',
          confidence: facts.length > 0 ? 0.92 : 0.78,
          reasons: [facts.length > 0
            ? 'Há sinal comercial verificável na conversa ou no CRM.'
            : 'O contato entrou pelo fluxo de interesse do empreendimento.'],
        }
      : {
          type: 'unknown',
          status: 'review',
          confidence: 0.35,
          reasons: ['Não há evidência comercial suficiente para confirmar que este contato é comprador.'],
        }

  const uniqueFacts = facts
    .sort((a, b) => b.score - a.score)
    .filter((fact, index, all) => all.findIndex(other => (
      other.kind === fact.kind && other.value === fact.value
    )) === index)
    .slice(0, 8)

  return {
    eligible: audience.status !== 'blocked',
    exclusionReason: exclusion,
    mode,
    safeName: safeFirstName(lead.name),
    anchor,
    angle: anchor?.angle ?? 'novidade',
    signals,
    transcript: deduped.slice(-10).map(item => `${item.inbound ? 'Lead' : 'Alliance'}: ${item.text.slice(0, 320)}`),
    audience,
    facts: uniqueFacts,
  }
}
