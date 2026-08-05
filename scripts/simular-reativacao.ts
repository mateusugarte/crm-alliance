/**
 * Simulação de mensagens de reativação contra leads reais.
 *
 * NÃO ENVIA NADA. Lê leads e interações do banco, monta exatamente o mesmo
 * contexto que a rota /api/leads/reactivation-context monta, e (quando há
 * OPENAI_API_KEY) chama a mesma função de geração usada em produção.
 *
 * Uso:
 *   npx tsx scripts/simular-reativacao.ts [quantidade]
 *
 * Sem OPENAI_API_KEY o script ainda roda: mostra o contexto de cada lead, o
 * prompt montado e a contagem de tokens — o suficiente para estimar custo.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import {
  analyzeReactivationContext,
  generateReactivationMessage,
  type ReactivationInteraction,
  type ReactivationLead,
} from '../src/lib/disparo/reactivation-message'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
}

const CAMPAIGN_THEME = `As obras do La Reserva avançaram bastante desde o nosso último contato: a fundação já está praticamente concluída e, em breve, começamos a subir os andares.

Estou te mandando essa mensagem porque estamos em um bom momento: quem entra agora ainda pega uma valorização interessante até o fim da obra, e estou aqui pra te ajudar a tomar a melhor decisão.

O projeto ainda faz sentido pra você?`

const SAMPLE_SIZE = Number(process.argv[2] ?? 10)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function readable(value: string | null) {
  const raw = value?.trim() ?? ''
  if (!raw.startsWith('{')) return raw.replace(/\s+/g, ' ')
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const text = [parsed.text, parsed.conversation].find(item => typeof item === 'string')
    return String(text ?? raw).replace(/\s+/g, ' ')
  } catch { return raw.replace(/\s+/g, ' ') }
}

async function main() {
  // Universo real de disparo: leads frios que nunca receberam reativação.
  const { data: pool, error } = await supabase
    .from('leads')
    .select('id,name,phone,stage,summary,intention,interaction_count,reactivation_count')
    .in('stage', ['lead_frio', 'lead_morno', 'nao_respondeu'])
    .limit(400)

  if (error) throw new Error(error.message)

  const candidates = (pool ?? []) as Array<ReactivationLead & { interaction_count: number | null }>
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, SAMPLE_SIZE)

  const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

  console.log(`# Simulação de reativação — ${shuffled.length} leads reais`)
  console.log(`\nGerado em ${new Date().toISOString()}`)
  console.log(`Modelo: ${openai ? 'gpt-4o-mini (produção)' : 'NENHUM — OPENAI_API_KEY ausente, só contexto'}\n`)

  let promptCharsTotal = 0

  for (const [index, lead] of shuffled.entries()) {
    const { data: rows } = await supabase
      .from('interactions')
      .select('lead_id,direction,sender_type,content,created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const interactions = ((rows ?? []) as ReactivationInteraction[]).reverse()
    const analysis = analyzeReactivationContext(lead, interactions)
    const inbound = interactions.filter(i => i.direction === 'inbound' || i.sender_type === 'lead')

    console.log(`\n${'='.repeat(78)}`)
    console.log(`## ${index + 1}. ${lead.name || '(sem nome)'}`)
    console.log(`${'='.repeat(78)}\n`)

    console.log(`**Lead** — ${lead.name || '(sem nome)'} · etapa: ${lead.stage} · ${interactions.length} interações (${inbound.length} do lead)`)
    console.log(`**Intenção:** ${lead.intention ?? '(não informada)'}`)
    console.log(`**Nome usável na saudação:** ${analysis.safeName ?? 'NÃO — saudação sem nome'}`)
    console.log(`**Modo de contexto:** ${analysis.mode}`)
    console.log(`**Elegível:** ${analysis.eligible ? 'sim' : `NÃO — ${analysis.exclusionReason}`}`)

    console.log(`\n**Contexto (resumo do CRM):**`)
    console.log(lead.summary ? `> ${lead.summary.replace(/\s+/g, ' ').slice(0, 500)}` : '> (sem resumo)')

    console.log(`\n**Contexto (últimas falas do lead):**`)
    if (inbound.length === 0) {
      console.log('> (o lead nunca respondeu)')
    } else {
      for (const item of inbound.slice(-4)) {
        console.log(`> - "${readable(item.content).slice(0, 240)}"`)
      }
    }

    console.log(`\n**Última fala útil usada como ponte:** ${analysis.reference ? `"${analysis.reference.slice(0, 200)}"` : '(nenhuma)'}`)

    if (!analysis.eligible) {
      console.log(`\n**Mensagem gerada:** — (lead excluído da campanha)`)
      continue
    }

    if (!openai) {
      console.log(`\n**Mensagem gerada:** (requer OPENAI_API_KEY)`)
      continue
    }

    const result = await generateReactivationMessage({
      openai,
      lead,
      interactions,
      campaignTheme: CAMPAIGN_THEME,
      manualContext: '',
    })

    console.log(`\n**Mensagem gerada:**`)
    if (result.message) {
      console.log(result.message.split('\n').map(line => `  ${line}`).join('\n'))
    } else {
      console.log(`  *** DESCARTADA PELO GATE DE QUALIDADE ***`)
    }
    console.log(`\n**Flags de qualidade:** ${result.quality_flags.length ? result.quality_flags.join(', ') : '(nenhuma)'}`)
    promptCharsTotal += CAMPAIGN_THEME.length + (lead.summary?.length ?? 0) + interactions.reduce((sum, i) => sum + (i.content?.length ?? 0), 0)
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`Média de caracteres de contexto por lead: ${Math.round(promptCharsTotal / Math.max(1, shuffled.length))}`)
}

main().catch(error => { console.error(error); process.exit(1) })
