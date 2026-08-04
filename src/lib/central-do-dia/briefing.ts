import { getOpenAI, CHAT_MODEL } from '@/lib/ai/openai-client'
import { centralQuery } from './db'
import { compactCommercialSummary } from '@/lib/lead-summary'

export interface TaskBriefing {
  contexto: string
  abertura: string
  objecao_provavel: string
}

interface BriefingCandidate {
  tarefa_id: string
  name: string
  city: string | null
  intention: string | null
  imovel_interesse: string | null
  summary: string | null
  summary_comercial_curto: string | null
  interaction_count: number | null
  stage: string
}

function fallbackBriefing(lead: BriefingCandidate): TaskBriefing {
  const details = [
    lead.intention ? `interesse em ${lead.intention === 'investir' ? 'investimento' : 'moradia'}` : null,
    lead.imovel_interesse,
    lead.city ? `de ${lead.city}` : null,
  ].filter(Boolean)

  const compactSummary = compactCommercialSummary({
    summary: lead.summary,
    shortSummary: lead.summary_comercial_curto,
    city: lead.city,
    intention: lead.intention as 'morar' | 'investir' | null,
    propertyInterest: lead.imovel_interesse,
  })

  return {
    contexto: compactSummary || (details.length ? details.join(' · ') : 'Sem informacao suficiente.'),
    abertura: `Oi, ${lead.name}. Aqui e da Alliance. Posso falar por um minuto sobre o La Reserva?`,
    objecao_provavel: 'Sem informacao suficiente.',
  }
}

async function generateBriefing(lead: BriefingCandidate): Promise<TaskBriefing> {
  if (!process.env.OPENAI_API_KEY) return fallbackBriefing(lead)

  const response = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'Crie um briefing de 30 segundos para uma ligacao comercial imobiliaria.',
          'Use somente os fatos fornecidos. Nao invente preco, prazo, preferencia ou objecao.',
          'Na ausencia de base factual, escreva exatamente "Sem informacao suficiente.".',
          'Responda JSON com contexto, abertura e objecao_provavel, todos strings curtos.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          nome: lead.name,
          cidade: lead.city,
          intencao: lead.intention,
          imovel_interesse: lead.imovel_interesse,
          resumo: lead.summary,
          interacoes: lead.interaction_count,
          estagio: lead.stage,
        }),
      },
    ],
  })

  const content = response.choices[0]?.message.content
  if (!content) return fallbackBriefing(lead)
  const parsed = JSON.parse(content) as Partial<TaskBriefing>
  const fallback = fallbackBriefing(lead)
  return {
    contexto: parsed.contexto?.trim() || fallback.contexto,
    abertura: parsed.abertura?.trim() || fallback.abertura,
    objecao_provavel: parsed.objecao_provavel?.trim() || fallback.objecao_provavel,
  }
}

export async function generatePendingBriefings(limit = 30) {
  const { rows } = await centralQuery<BriefingCandidate>(
    `select t.id tarefa_id, l.name, l.city, l.intention, l.imovel_interesse,
            l.summary, l.summary_comercial_curto, l.interaction_count, l.stage
       from tarefas t
       join leads l on l.id=t.lead_id
      where t.status in ('pendente','vencida') and t.briefing is null
      order by t.vence_em
      limit $1`,
    [limit],
  )

  let generated = 0
  for (const lead of rows) {
    try {
      const briefing = await generateBriefing(lead)
      await centralQuery('update tarefas set briefing=$1::jsonb where id=$2 and briefing is null', [
        JSON.stringify(briefing),
        lead.tarefa_id,
      ])
      await centralQuery(
        `update mensagens_saida
            set corpo = corpo || E'\nAbrir por: "' || $1 || E'"\nProvavel objecao: ' || $2
          where enviada_em is null
            and contexto->>'tipo'='lead_qualificado'
            and contexto->>'lead_id'=(select lead_id::text from tarefas where id=$3)
            and corpo not like '%Abrir por:%'`,
        [briefing.abertura, briefing.objecao_provavel, lead.tarefa_id],
      )
      generated += 1
    } catch (error) {
      console.error('[central-do-dia] briefing falhou', lead.tarefa_id, error)
    }
  }

  return generated
}
