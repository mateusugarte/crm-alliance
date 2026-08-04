import pg from 'pg'

const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL
const APPLY = process.env.APPLY === '1'
const LIMIT = Number.parseInt(process.env.LIMIT ?? '0', 10)
const GENERATED_BY = 'deterministic_v1'

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const STAGE_LABELS = {
  nao_respondeu: 'não respondeu',
  lead_frio: 'frio',
  lead_morno: 'morno',
  lead_quente: 'quente',
  reuniao_agendada: 'reunião agendada',
  follow_up: 'follow-up',
  sem_interesse: 'sem interesse',
  visita_confirmada: 'venda confirmada',
  cliente: 'cliente',
}

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const cleanSnippet = value => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 180)

function cleanField(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  const normalized = normalize(text)
  if (!text || ['nao', 'não', 'n/a', 'na', 'brazil', 'brasil', 'undefined', 'null'].includes(normalized)) return ''
  return text
}

function hasAny(text, words) {
  return words.some(word => text.includes(word))
}

function detectSignals(lead, inbound, outbound) {
  const inboundText = normalize(inbound.map(item => item.content).join('\n'))
  const outboundText = normalize(outbound.map(item => item.content).join('\n'))
  const allText = `${inboundText}\n${outboundText}`

  const signals = {
    inbound_count: inbound.length,
    outbound_count: outbound.length,
    has_response: inbound.length > 0,
    aceitou_consultor: lead.aceitou_consultor === true || hasAny(inboundText, ['consultor', 'corretor', 'me liga', 'pode ligar', 'ligacao', 'ligar', 'whatsapp', 'falar com']),
    pediu_preco: hasAny(inboundText, ['preco', 'valor', 'quanto', 'tabela', 'entrada', 'financiamento', 'financiar', 'parcela', 'condicao', 'condicoes']),
    pediu_unidade: hasAny(inboundText, ['unidade', 'apartamento', 'apto', 'planta', 'metragem', 'm2', 'quarto', 'suite', 'vaga', 'andar']),
    pediu_localizacao: hasAny(inboundText, ['onde fica', 'localizacao', 'bairro', 'castelo', 'endereco', 'regiao']),
    obra_entrega: hasAny(inboundText, ['obra', 'entrega', 'pronto', 'fase', 'construcao', 'prazo']),
    morar: lead.intention === 'morar' || hasAny(inboundText, ['morar', 'moro', 'moradia', 'minha familia', 'familia']),
    investir: lead.intention === 'investir' || hasAny(inboundText, ['investir', 'investimento', 'renda', 'alugar', 'locacao', 'valorizacao']),
    objecao: hasAny(inboundText, ['caro', 'sem interesse', 'nao tenho interesse', 'nao quero', 'depois', 'mais pra frente', 'agora nao', 'orçamento', 'orcamento']),
    disparos: Number(lead.reactivation_count ?? 0),
    pdf_enviado: lead.pdf_enviado === true || hasAny(allText, ['pdf', 'material', 'catalogo', 'folder']),
  }

  return signals
}

function listSignals(signals) {
  const items = []
  if (signals.aceitou_consultor) items.push('aceitou falar com consultor/corretor')
  if (signals.pediu_preco) items.push('pediu preço, tabela, condição ou financiamento')
  if (signals.pediu_unidade) items.push('pediu detalhes de unidade, quartos, metragem ou planta')
  if (signals.pediu_localizacao) items.push('pediu localização ou detalhes da região')
  if (signals.obra_entrega) items.push('perguntou sobre obra, prazo ou entrega')
  if (signals.morar) items.push('indicou intenção de morar')
  if (signals.investir) items.push('indicou intenção de investir')
  if (signals.pdf_enviado) items.push('recebeu material/PDF')
  if (signals.objecao) items.push('trouxe objeção ou indicou baixo interesse')
  return items
}

function nextStep(lead, signals) {
  if (lead.stage === 'sem_interesse') return 'Manter fora do fluxo ativo, salvo nova sinalização manual.'
  if (lead.stage === 'visita_confirmada' || lead.stage === 'cliente') return 'Acompanhar pós-venda e manter histórico atualizado.'
  if (lead.stage === 'follow_up') return 'Retomar follow-up com contexto da reunião e confirmar decisão/objeção.'
  if (lead.stage === 'reuniao_agendada') return 'Confirmar presença e preparar abordagem com os pontos de interesse.'
  if (lead.stage === 'lead_quente' || signals.aceitou_consultor) return 'Priorizar ligação/WhatsApp humano e tentar avançar para reunião ou proposta.'
  if (lead.stage === 'lead_morno' || signals.pediu_preco || signals.pediu_unidade || signals.pediu_localizacao || signals.obra_entrega) return 'Responder com informação objetiva e puxar para consultor ou visita.'
  if (!signals.has_response) return 'Manter em nutrição leve; ainda não há contexto suficiente para abordagem consultiva.'
  return 'Fazer contato leve, coletar interesse real e buscar próxima pergunta de qualificação.'
}

function buildSummary(lead, interactions) {
  const inbound = interactions.filter(item => item.direction === 'inbound' || item.sender_type === 'lead')
  const outbound = interactions.filter(item => item.direction === 'outbound' && item.sender_type !== 'lead')
  const signals = detectSignals(lead, inbound, outbound)
  const signalList = listSignals(signals)
  const stageLabel = STAGE_LABELS[lead.stage] ?? lead.stage ?? 'sem estágio'
  const lastInbound = inbound.at(-1)
  const lastLeadMessage = lastInbound ? cleanSnippet(lastInbound.content) : ''

  const context = []
  const city = cleanField(lead.city)
  const interest = cleanField(lead.imovel_interesse)

  context.push(`Resumo: Lead classificado como ${stageLabel}.`)

  if (interest) context.push(`Interesse registrado: ${interest}.`)
  if (city) context.push(`Cidade/região informada: ${city}.`)
  if (lead.intention === 'morar') context.push('Intenção registrada: morar.')
  if (lead.intention === 'investir') context.push('Intenção registrada: investir.')

  if (!signals.has_response) {
    context.push('Até agora não há resposta útil do lead registrada no CRM.')
  } else if (lastLeadMessage) {
    context.push(`Última resposta útil do lead: "${lastLeadMessage}".`)
  }

  const signalText = signalList.length > 0
    ? signalList.map(item => `- ${item}`).join('\n')
    : '- sem sinais comerciais fortes identificados nas mensagens'

  const attention = signals.objecao
    ? '\nPonto de atenção:\n- existe sinal de objeção, desinteresse ou postergação; abordar com cuidado.'
    : ''

  return {
    summary: [
      context.join(' '),
      '',
      'Sinais identificados:',
      signalText,
      attention,
      '',
      `Próximo passo sugerido: ${nextStep(lead, signals)}`,
    ].filter(Boolean).join('\n').trim(),
    signals,
  }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sql = `
    select
      l.id,
      l.name,
      l.phone,
      l.city,
      l.stage,
      l.intention,
      l.imovel_interesse,
      l.summary,
      l.interaction_count,
      l.aceitou_consultor,
      l.reactivation_count,
      l.last_reactivated_at,
      l.pdf_enviado,
      l.lead_score,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'direction', i.direction,
            'sender_type', i.sender_type,
            'content', i.content,
            'created_at', i.created_at
          )
          order by i.created_at
        ) filter (where i.id is not null),
        '[]'::jsonb
      ) as interactions
    from public.leads l
    left join public.interactions i on i.lead_id = l.id
    group by l.id
    order by l.updated_at desc
    ${LIMIT > 0 ? 'limit $1' : ''}
  `

  const { rows } = await client.query(sql, LIMIT > 0 ? [LIMIT] : [])
  const updates = rows.map(lead => {
    const { summary, signals } = buildSummary(lead, lead.interactions ?? [])
    return { lead, summary, signals }
  }).filter(item => item.summary && item.summary !== item.lead.summary)

  console.log(`${rows.length} leads analyzed`)
  console.log(`${updates.length} summaries ${APPLY ? 'to update' : 'would be updated'}`)

  for (const item of updates.slice(0, 5)) {
    console.log('\n---')
    console.log(`${item.lead.name || item.lead.phone} (${item.lead.stage})`)
    console.log(item.summary.slice(0, 600))
  }

  if (!APPLY) {
    await client.end()
    return
  }

  await client.query('begin')
  try {
    for (const item of updates) {
      await client.query(
        `
          insert into public.lead_summary_rewrite_audit
            (lead_id, old_summary, new_summary, generated_by, signals)
          values ($1, $2, $3, $4, $5::jsonb)
        `,
        [item.lead.id, item.lead.summary, item.summary, GENERATED_BY, JSON.stringify(item.signals)]
      )

      await client.query(
        `
          update public.leads
          set summary = $2
          where id = $1
        `,
        [item.lead.id, item.summary]
      )
    }
    await client.query('commit')
    console.log(`${updates.length} summaries updated`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
