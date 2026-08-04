import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { centralQuery } from '@/lib/central-do-dia/db'

function authorized(request: NextRequest) {
  const secret = process.env.OUTBOX_SECRET
  return Boolean(secret) && (
    request.headers.get('authorization') === `Bearer ${secret}`
    || request.headers.get('x-outbox-secret') === secret
  )
}
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const worker = request.nextUrl.searchParams.get('worker') || randomUUID()
  const requested = Number(request.nextUrl.searchParams.get('limit') || 10)
  const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 10, 50))

  const { rows } = await centralQuery(
    `with picked as (
       select id from mensagens_saida
        where enviada_em is null
          and (processando_em is null or processando_em < now()-interval '5 minutes')
          and tentativas < 8
        order by criada_em
        for update skip locked
        limit $1
     )
     update mensagens_saida m
        set processando_em=now(), processando_por=$2, tentativas=tentativas+1
       from picked p where m.id=p.id
     returning m.id,m.destino,m.destino_tipo,m.corpo,m.contexto,m.tentativas`,
    [limit, worker],
  )

  return NextResponse.json({ worker, data: rows })
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json() as { id?: string; worker?: string; sent?: boolean; error?: string | null }
  if (!body.id || !body.worker) return NextResponse.json({ error: 'id e worker obrigatorios' }, { status: 400 })

  const { rows } = await centralQuery<{ id: string }>(
    `update mensagens_saida
        set enviada_em=case when $3 then now() else enviada_em end,
            erro=case when $3 then null else nullif($4,'') end,
            processando_em=null,
            processando_por=null
      where id=$1 and processando_por=$2
      returning id`,
    [body.id, body.worker, body.sent === true, body.error ?? null],
  )
  if (!rows.length) return NextResponse.json({ error: 'Reserva nao encontrada' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
