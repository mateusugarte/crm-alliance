import { NextRequest, NextResponse } from 'next/server'
import { authorizeN8N } from '@/lib/call-checkin/auth'
import { abrirCheckin, coletarRespostas } from '@/lib/call-checkin/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface Payload {
  acao?: 'abrir' | 'coletar'
  grupo_jid?: string
}

/**
 * Check-in diario de ligacoes, acionado pelo N8N:
 * - abrir: pergunta no grupo quais leads qualificados receberam ligacao (17h)
 * - coletar: le as respostas novas do grupo e o agente de check-in registra no CRM
 */
export async function POST(request: NextRequest) {
  if (!authorizeN8N(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Payload
  try {
    if (body.acao === 'abrir') {
      const grupoJid = body.grupo_jid?.trim()
      if (!grupoJid?.endsWith('@g.us')) {
        return NextResponse.json({ error: 'grupo_jid invalido' }, { status: 400 })
      }
      return NextResponse.json({ ok: true, ...(await abrirCheckin(grupoJid)) })
    }
    if (body.acao === 'coletar') {
      return NextResponse.json({ ok: true, ...(await coletarRespostas()) })
    }
    return NextResponse.json({ error: 'acao deve ser abrir ou coletar' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no check-in de ligacoes'
    console.error('[call-checkin]', body.acao, message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
