/**
 * Audita contatos da coluna Lead frio que claramente não são compradores.
 *
 * SOMENTE LEITURA. A saída é JSON para permitir revisão humana antes de
 * qualquer mudança de estágio.
 *
 *   npx tsx scripts/auditar-nao-compradores.ts
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import {
  exclusionReason,
  isInbound,
  readableContent,
  type BriefInteraction,
} from '../src/lib/disparo/lead-brief'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match && !process.env[match[1]!]) {
    process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}

type CandidateCategory = 'fornecedor' | 'emprego' | 'parceiro' | 'bot_terceiro' | 'teste'

type Candidate = {
  id: string
  name: string | null
  category: CandidateCategory
  reason: string
  evidence: string[]
}

const JOB_SEEKER = [
  /\b(?:curr[ií]culo|curriculum|vaga de emprego|oportunidade de emprego|oportunidade profissional|processo seletivo)\b/i,
  /\bcontrata[cç][aã]o (?:de )?emprego\b/i,
  /\b(?:est[aã]o|est[aá]) contratando\b/i,
  /\b(?:est[aã]o|t[aã]o|est[aá]) precisando d[ei]? funcion[aá]rios?\b/i,
  /\b(?:gostaria|quero|tenho interesse)\b.{0,50}\btrabalhar (?:na|com a|com voc[eê]s)\b/i,
  /\b(?:enviar|encaminhar|deixar)\b.{0,30}\b(?:meu )?curr[ií]culo\b/i,
]

const COMMERCIAL_PARTNER = [
  /\b(?:proposta|oportunidade) de parceria\b/i,
  /\bparceria comercial\b/i,
  /\b(?:ag[eê]ncia|assessoria)\b.{0,40}\b(?:marketing|tr[aá]fego|publicidade|comunica[cç][aã]o)\b/i,
  /\b(?:tr[aá]fego pago|gest[aã]o de redes sociais|social media|produ[cç][aã]o de conte[uú]do)\b/i,
  /\b(?:oferecer|alinhar)\b.{0,60}\b(?:terrenos?|im[oó]veis?|permuta)\b.{0,60}\b(?:construir|incorporar|incorpora[cç][aã]o)\b/i,
  /\boferecer im[oó]veis para voc[eê]s constru[ií]rem\b/i,
  /\bsetor de incorpora[cç][aã]o\b.{0,100}\b(?:ofertar|oportunidades?|terrenos?)\b/i,
  /\b(?:imobili[aá]ria|corretor)\b.{0,100}\b(?:presta[cç][aã]o de servi[cç]os?|apresentar (?:a )?audi[eê]ncia|parceria)\b/i,
  /\bpresta[cç][aã]o de servi[cç]os em conjunto\b/i,
  /\btrabalho no Banestes\b.{0,160}\bparceria\b/i,
]

const SUPPLIER_EXTRA = [
  /\b(?:setor|departamento) de compras\b/i,
  /\btenho uma entrega (?:para|pra) voc[eê]s\b/i,
  /\b(?:representante|distribuidor|fabricante)\b.{0,80}\b(?:material|produto|equipamento|solu[cç][aã]o|marca)\b/i,
  /\b(?:fornecemos|vendemos|fabricamos|locamos)\b.{0,80}\b(?:obra|constru[cç][aã]o|construtora|empreendimento)\b/i,
  /\bbrindes?\W{0,8}personalizados?\b|\bpapelaria corporativa\b/i,
]

const UNRELATED_BUSINESS_OR_BOT = [
  /\b(?:assistente virtual|intelig[eê]ncia artificial) da UNIASSELVI\b/i,
  /\bbem-vindo ao mundo Est[aá]cio\b/i,
  /\bassistente virtual da PUCRS\b/i,
  /\bempresa ProHair\b/i,
  /\bConcession[aá]ria Honda\b/i,
  /\bA Decolar te aguarda\b/i,
  /\bConsult[oó]rio da Dra\.?\b/i,
  /\bequipe do Dr\.?\b.{0,100}\b(?:beleza|rosto|facial)\b/i,
  /\bConsultor imobili[aá]rio agradece seu contato\b/i,
  /\bn[aã]o possu[ií]mos mais loja\b.{0,80}\bgaleria\b/i,
  /\bWhatsApp (?:é )?utilizado exclusivamente para o envio de informa[cç][oõ]es\b/i,
]

function firstMatchingEvidence(messages: string[], patterns: RegExp[]) {
  return messages.filter(message => patterns.some(pattern => pattern.test(message))).slice(0, 3)
}

function classify(name: string | null, inbound: string[]): Omit<Candidate, 'id' | 'name'> | null {
  if (/\bteste\b/i.test(name ?? '')) {
    return {
      category: 'teste',
      reason: 'Contato de teste, não deve permanecer no funil comercial.',
      evidence: inbound.slice(-3),
    }
  }

  const builtInReason = exclusionReason(name, inbound.slice(-12))
  if (builtInReason?.includes('atendimento automático')) {
    return {
      category: 'bot_terceiro',
      reason: builtInReason,
      evidence: inbound.slice(-4),
    }
  }
  if (builtInReason?.includes('prestar serviço')) {
    return {
      category: 'fornecedor',
      reason: builtInReason,
      evidence: inbound.slice(-6),
    }
  }
  if (builtInReason?.includes('Contato de teste')) {
    return {
      category: 'teste',
      reason: builtInReason,
      evidence: inbound.slice(-3),
    }
  }

  const unrelatedEvidence = firstMatchingEvidence(inbound, UNRELATED_BUSINESS_OR_BOT)
  if (unrelatedEvidence.length) {
    return {
      category: 'bot_terceiro',
      reason: 'O número pertence a outra empresa ou atendimento automático, não a um comprador.',
      evidence: unrelatedEvidence,
    }
  }

  const jobEvidence = firstMatchingEvidence(inbound, JOB_SEEKER)
  if (jobEvidence.length) {
    return {
      category: 'emprego',
      reason: 'O contato procura emprego, não uma unidade do empreendimento.',
      evidence: jobEvidence,
    }
  }

  const supplierEvidence = firstMatchingEvidence(inbound, SUPPLIER_EXTRA)
  if (supplierEvidence.length) {
    return {
      category: 'fornecedor',
      reason: 'O contato oferece produto, serviço ou entrega para a empresa.',
      evidence: supplierEvidence,
    }
  }

  const partnerEvidence = firstMatchingEvidence(inbound, COMMERCIAL_PARTNER)
  if (partnerEvidence.length) {
    return {
      category: 'parceiro',
      reason: 'O contato propõe parceria comercial, não a compra de uma unidade.',
      evidence: partnerEvidence,
    }
  }

  return null
}

async function main() {
  const client = new Client({
    connectionString: process.env.PG_MEMORY_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const { rows: leads } = await client.query<{ id: string; name: string | null }>(
    `SELECT id, name FROM leads WHERE stage = 'lead_frio' ORDER BY created_at`,
  )
  const { rows: interactions } = await client.query<BriefInteraction>(
    `SELECT i.lead_id, i.direction, i.sender_type, i.content, i.created_at
       FROM interactions i
       JOIN leads l ON l.id = i.lead_id
      WHERE l.stage = 'lead_frio'
      ORDER BY i.lead_id, i.created_at`,
  )

  const byLead = new Map<string, BriefInteraction[]>()
  for (const interaction of interactions) {
    byLead.set(interaction.lead_id, [...(byLead.get(interaction.lead_id) ?? []), interaction])
  }

  const candidates: Candidate[] = []
  for (const lead of leads) {
    const inbound = (byLead.get(lead.id) ?? [])
      .filter(isInbound)
      .map(interaction => readableContent(interaction.content))
      .filter(Boolean)
    const result = classify(lead.name, inbound)
    if (!result) continue
    candidates.push({
      id: lead.id,
      name: lead.name,
      ...result,
      evidence: result.evidence.map(item => item.slice(0, 300)),
    })
  }

  const totals = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.category] = (acc[candidate.category] ?? 0) + 1
    return acc
  }, {})

  console.log(JSON.stringify({
    audited_leads: leads.length,
    candidates: candidates.length,
    totals,
    results: candidates,
  }, null, 2))

  await client.end()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
