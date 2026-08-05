/**
 * Mostra a conversa completa e o briefing de um lead pelo nome.
 * SOMENTE LEITURA.
 *
 *   npx tsx scripts/inspecionar-lead.ts "Arthur Franco"
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { buildLeadBrief, type BriefInteraction, type BriefLead } from '../src/lib/disparo/lead-brief'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
}

async function main() {
  const client = new Client({ connectionString: process.env.PG_MEMORY_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const { rows: leads } = await client.query<BriefLead>(
    `SELECT id, name, phone, stage, summary, intention FROM leads WHERE name ILIKE $1 LIMIT 3`,
    [`%${process.argv[2] ?? ''}%`],
  )

  for (const lead of leads) {
    const { rows } = await client.query<BriefInteraction>(
      `SELECT lead_id, direction, sender_type, content, created_at
         FROM interactions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [lead.id],
    )
    const brief = buildLeadBrief(lead, rows.reverse())
    console.log(`\n${'='.repeat(70)}\n${lead.name} — ${lead.stage}`)
    console.log(`elegível: ${brief.eligible}${brief.exclusionReason ? ` (${brief.exclusionReason})` : ''}`)
    console.log(`modo: ${brief.mode} | ângulo: ${brief.angle} | nome: ${brief.safeName}`)
    console.log(`âncora: ${brief.anchor ? `[${brief.anchor.score}] ${brief.anchor.quote}` : '—'}`)
    console.log(`sinais: ${brief.signals.join(' · ') || '—'}`)
    console.log('\n--- conversa ---')
    for (const line of brief.transcript) console.log(`  ${line.slice(0, 220)}`)
  }

  await client.end()
}

main().catch(error => { console.error(error); process.exit(1) })
