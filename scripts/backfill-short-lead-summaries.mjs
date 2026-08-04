import pg from 'pg'

const { Client } = pg
const connectionString = process.env.PG_MEMORY_URL || process.env.DATABASE_URL
const apply = process.env.APPLY === '1'

if (!connectionString) throw new Error('PG_MEMORY_URL ou DATABASE_URL e obrigatoria')

function clean(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return !text || /^(não informado|nao informado|não|nao|brazil)$/i.test(text) ? null : text
}

function finish(value) {
  const text = value.trim().replace(/[.,;:]+$/, '')
  return text ? `${text}.` : ''
}

function clamp(value, max = 330) {
  if (value.length <= max) return value
  const clipped = value.slice(0, max + 1)
  const boundary = clipped.lastIndexOf(' ')
  return `${clipped.slice(0, boundary > max * 0.7 ? boundary : max).trim()}...`
}

function oldSummaryFallback(summary) {
  const cleaned = String(summary ?? '')
    .replace(/^Resumo:\s*/i, '')
    .replace(/Lead classificado como [^.]+\.\s*/i, '')
    .replace(/,?\s*com score \d+(?:[.,]\d+)?\/10/gi, '')
    .replace(/Última resposta útil do lead:\s*["“][^"”]*["”]\.*/gi, '')
    .split(/Sinais identificados:|Ponto de atenção:|Ponto de atencao:|Próximo passo sugerido:|Proximo passo sugerido:/i)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

function build(row) {
  const source = row.summary ?? ''
  const property = clean(row.imovel_interesse)
  const city = clean(row.city)
  const opening = property
    ? `Busca ${property}${row.intention ? ` para ${row.intention === 'morar' ? 'morar' : 'investir'}` : ''}${city ? ` em ${city}` : ''}`
    : row.intention
      ? `Procura uma oportunidade para ${row.intention === 'morar' ? 'moradia' : 'investimento'}${city ? ` em ${city}` : ''}`
      : `Demonstrou interesse no La Reserva${city ? ` e informou estar em ${city}` : ''}`

  const interests = []
  if (/preço|preco|valor|tabela|condiç|condic|financi|simulaç|simulac/i.test(source)) interests.push('preços e condições')
  if (/metragem|m²|quarto|planta|unidade|cobertura/i.test(source)) interests.push('plantas e metragens')
  if (/localizaç|localizac|região|regiao/i.test(source)) interests.push('localização')
  if (/obra|prazo|entrega/i.test(source)) interests.push('andamento da obra')

  const detail = interests.length
    ? `Pediu informações sobre ${interests.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' e $1')}`
    : null
  const consultant = row.aceitou_consultor ? 'Aceitou conversar com um consultor' : null

  if (detail || property || row.intention || city || row.aceitou_consultor) {
    return clamp([
      finish(opening),
      detail ? finish(detail) : '',
      consultant ? finish(consultant) : '',
    ].filter(Boolean).join(' '))
  }
  return clamp(oldSummaryFallback(source) || 'Ainda não há contexto comercial suficiente para resumir este lead.')
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query(
    `select id,name,city,intention,imovel_interesse,summary,aceitou_consultor,summary_comercial_curto
       from leads order by updated_at desc`,
  )
  const updates = rows
    .map(row => ({ id: row.id, name: row.name, before: row.summary_comercial_curto, after: build(row) }))
    .filter(row => row.after !== row.before)

  console.log(`${rows.length} leads analisados; ${updates.length} resumos curtos ${apply ? 'serao atualizados' : 'seriam atualizados'}.`)
  for (const item of updates.slice(0, 5)) console.log(`- ${item.name}: ${item.after}`)

  if (apply && updates.length) {
    await client.query('begin')
    for (const item of updates) {
      await client.query(
        `update leads set summary_comercial_curto=$2,summary_comercial_atualizado_em=now() where id=$1`,
        [item.id, item.after],
      )
    }
    await client.query('commit')
    console.log(`${updates.length} resumos curtos atualizados.`)
  }
} catch (error) {
  try { await client.query('rollback') } catch {}
  throw error
} finally {
  await client.end()
}
