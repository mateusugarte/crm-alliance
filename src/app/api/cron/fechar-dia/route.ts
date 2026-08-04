import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { authorizeCron, localDate, unauthorizedCron } from '@/lib/central-do-dia/cron'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()
  const date = localDate()
  const { rows } = await centralQuery<{ total: number }>(
    'select fechar_fila_do_dia($1::date)::int total',
    [date],
  )
  return NextResponse.json({ ok: true, date, closed: rows[0]?.total ?? 0 })
}
