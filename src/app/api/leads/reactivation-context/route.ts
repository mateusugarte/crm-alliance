import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const STAGE_LABELS: Record<string, string> = {
  nao_respondeu:     'Não respondeu',
  lead_frio:         'Lead Frio',
  lead_morno:        'Lead Morno',
  lead_quente:       'Lead Quente',
  follow_up:         'Follow-up',
  reuniao_agendada:  'Reunião Agendada',
  visita_confirmada: 'Venda Confirmada',
  cliente:           'Cliente',
}

type LeadRow = {
  id: string
  name: string | null
  phone: string | null
  stage: string | null
  summary: string | null
  intention: string | null
}

type InteractionRow = {
  lead_id: string
  direction: string | null
  sender_type: string | null
  content: string | null
  created_at: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const body = await req.json() as { lead_ids?: string[]; manual_contexts?: Record<string, string> }
  const { lead_ids, manual_contexts = {} } = body

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids obrigatório' }, { status: 400 })
  }
  if (lead_ids.length > 50) {
    return NextResponse.json({ error: 'Máximo 50 leads por vez' }, { status: 400 })
  }

  const service = createServiceClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const { data: leadsRaw } = await service
    .from('leads')
    .select('id, name, phone, stage, summary, intention')
    .in('id', lead_ids)

  const leads = (leadsRaw ?? []) as LeadRow[]
  if (!leads.length) {
    return NextResponse.json({ error: 'Nenhum lead encontrado' }, { status: 404 })
  }

  const { data: interactionsRaw } = await service
    .from('interactions')
    .select('lead_id, direction, sender_type, content, created_at')
    .in('lead_id', lead_ids)
    .order('created_at', { ascending: false })
    .limit(lead_ids.length * 20)

  const interactions = (interactionsRaw ?? []) as InteractionRow[]

  const interactionsByLead: Record<string, InteractionRow[]> = {}
  for (const row of interactions) {
    if (!interactionsByLead[row.lead_id]) interactionsByLead[row.lead_id] = []
    if ((interactionsByLead[row.lead_id]?.length ?? 0) < 20) {
      interactionsByLead[row.lead_id]?.push(row)
    }
  }

  const generateForLead = async (lead: LeadRow): Promise<{ lead_id: string; name: string; phone: string; message: string }> => {
    const leadInteractions = (interactionsByLead[lead.id] ?? []).reverse()
    const manualContext = manual_contexts[lead.id]?.trim() ?? ''

    const conversationText = leadInteractions.length > 0
      ? leadInteractions.map(i => {
          const who = i.sender_type === 'lead' ? (lead.name ?? 'Lead') : (i.sender_type === 'bot' ? 'Bot IA' : 'Corretor')
          return `${who}: ${i.content ?? ''}`
        }).join('\n')
      : '(sem histórico de conversa)'

    const prompt = `Você é especialista em vendas imobiliárias de alto padrão.

Contexto: Você é corretor da Alliance Investimentos Imobiliários. O lead abaixo não está mais respondendo e você precisa criar UMA mensagem de reativação personalizada para WhatsApp.

Lead: ${lead.name ?? 'Lead'}
Etapa: ${STAGE_LABELS[lead.stage ?? ''] ?? lead.stage ?? 'Desconhecida'}${lead.intention ? `\nInteresse: ${lead.intention === 'morar' ? 'Morar' : 'Investir'}` : ''}${lead.summary ? `\nResumo: ${lead.summary}` : ''}${manualContext ? `\nContexto adicional informado pelo corretor: ${manualContext}` : ''}

Histórico da conversa (mais recentes):
${conversationText}

${manualContext
  ? `O corretor forneceu contexto adicional acima — use-o como ponto central da mensagem, combinando com o histórico para criar continuidade.`
  : `Use o histórico da conversa para criar uma mensagem que dê continuidade natural ao que foi discutido.`
}

A mensagem DEVE:
- Ser uma mensagem de REATIVAÇÃO — o lead parou de responder e você está tentando retomar o contato
- Fazer sentido com a situação do lead (não pode ser genérica ou sem contexto)
- Referenciar algo específico da conversa, do interesse ou do contexto fornecido
- Ser curta (1 a 3 frases), natural, como uma pessoa enviaria no WhatsApp
- Criar curiosidade ou abertura para retomar a conversa — sem pressão excessiva
- Estar em português brasileiro informal

Retorne APENAS a mensagem, sem aspas, sem explicações.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.85,
      })
      const message = completion.choices[0]?.message?.content?.trim() ?? ''
      return { lead_id: lead.id, name: lead.name ?? '', phone: lead.phone ?? '', message }
    } catch {
      return { lead_id: lead.id, name: lead.name ?? '', phone: lead.phone ?? '', message: '' }
    }
  }

  const results: { lead_id: string; name: string; phone: string; message: string }[] = []
  for (let i = 0; i < leads.length; i += 5) {
    const batch = leads.slice(i, i + 5)
    const batchResults = await Promise.all(batch.map(generateForLead))
    results.push(...batchResults)
  }

  return NextResponse.json({ results })
}
