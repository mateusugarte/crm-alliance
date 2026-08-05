/**
 * Extrai o briefing real de reativação de N leads aleatórios do banco.
 *
 * SOMENTE LEITURA — nenhum INSERT/UPDATE, nenhuma mensagem enviada.
 *
 * Roda o mesmo `buildLeadBrief` que a produção usa, para auditar as decisões
 * do pipeline (exclusão, âncora, ângulo) sem gastar chamada de modelo.
 *
 *   npx tsx scripts/dump-contexto-reativacao.ts [quantidade]
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { buildLeadBrief, type BriefInteraction, type BriefLead } from '../src/lib/disparo/lead-brief'
import { sanitizeCampaignTheme } from '../src/lib/disparo/reactivation-message'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
}

const CAMPAIGN_THEME = `As obras do La Reserva avançaram bastante desde o nosso último contato: a fundação já está praticamente concluída e, em breve, começamos a subir os andares.

Estou te mandando essa mensagem porque estamos em um bom momento: quem entra agora ainda pega uma valorização interessante até o fim da obra, e estou aqui pra te ajudar a tomar a melhor decisão.

O projeto ainda faz sentido pra você?`

const N = Number(process.argv[2] ?? 10)

async function main() {
  const client = new Client({
    connectionString: process.env.PG_MEMORY_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  // Amostra estratificada: o pipeline se comporta de forma diferente conforme
  // o lead tenha ou não conversa real, então forçamos os dois extremos.
  const { rows: leads } = await client.query<BriefLead & { interaction_count: number }>(`
    (SELECT id, name, phone, stage, summary, intention, interaction_count
       FROM leads
      WHERE stage IN ('lead_frio','lead_morno','nao_respondeu') AND interaction_count >= 4
      ORDER BY random() LIMIT $1)
    UNION ALL
    (SELECT id, name, phone, stage, summary, intention, interaction_count
       FROM leads
      WHERE stage IN ('lead_frio','lead_morno','nao_respondeu') AND interaction_count BETWEEN 1 AND 3
      ORDER BY random() LIMIT $2)
  `, [Math.ceil(N / 2), Math.floor(N / 2)])

  const out = []
  for (const lead of leads) {
    const { rows } = await client.query<BriefInteraction>(
      `SELECT lead_id, direction, sender_type, content, created_at
         FROM interactions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [lead.id],
    )
    const brief = buildLeadBrief(lead, rows.reverse())
    out.push({
      nome: lead.name,
      etapa: lead.stage,
      interacoes: lead.interaction_count,
      elegivel: brief.eligible,
      motivo_exclusao: brief.exclusionReason,
      modo: brief.mode,
      nome_saudacao: brief.safeName,
      angulo: brief.angle,
      ancora: brief.anchor,
      sinais: brief.signals,
      tema_saneado: sanitizeCampaignTheme(CAMPAIGN_THEME, brief.mode),
      conversa: brief.transcript,
    })
  }

  console.log(JSON.stringify({ tema_original: CAMPAIGN_THEME, leads: out }, null, 2))
  await client.end()
}

main().catch(error => { console.error(error); process.exit(1) })
