/**
 * Audita as exclusões do disparo contra o banco real.
 *
 * SOMENTE LEITURA. Lista todo lead que o pipeline tiraria da campanha, com o
 * motivo e as falas que dispararam a regra — para caçar falso positivo, que
 * neste domínio custa um comprador.
 *
 *   npx tsx scripts/auditar-exclusoes.ts [limite]
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { exclusionReason, isInbound, readableContent, type BriefInteraction } from '../src/lib/disparo/lead-brief'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
}

const LIMIT = Number(process.argv[2] ?? 200)

async function main() {
  const client = new Client({
    connectionString: process.env.PG_MEMORY_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const { rows: leads } = await client.query<{ id: string; name: string | null }>(
    `SELECT id, name FROM leads
      WHERE stage IN ('lead_frio','lead_morno','nao_respondeu') AND interaction_count >= 1
      ORDER BY random() LIMIT $1`,
    [LIMIT],
  )

  let excluded = 0
  for (const lead of leads) {
    const { rows } = await client.query<BriefInteraction>(
      `SELECT lead_id, direction, sender_type, content, created_at
         FROM interactions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [lead.id],
    )
    const inbound = rows.reverse().filter(isInbound).map(row => readableContent(row.content)).filter(Boolean)
    const reason = exclusionReason(lead.name, inbound.slice(-8))
    if (!reason) continue

    excluded += 1
    console.log(`\n### ${lead.name ?? '(sem nome)'} → ${reason}`)
    for (const [index, message] of inbound.slice(-8).entries()) {
      console.log(`  ${index}. ${message.slice(0, 160)}`)
    }
  }

  console.log(`\n${excluded} de ${leads.length} leads seriam excluídos (${((excluded / leads.length) * 100).toFixed(1)}%).`)
  await client.end()
}

main().catch(error => { console.error(error); process.exit(1) })
