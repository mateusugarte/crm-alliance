import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { authorizeCron, localDate, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { failCronRun, finishCronRun, startCronRun, type CronRun } from '@/lib/central-do-dia/cron-run'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()
  const date = localDate()
  let run: CronRun | null = null
  try {
    run = await startCronRun('fechar-dia', date)
    const { rows } = await centralQuery<{ total: number }>(
      'select fechar_fila_do_dia($1::date)::int total',
      [date],
    )
    const closed = rows[0]?.total ?? 0
    await finishCronRun(run, { closed })
    return NextResponse.json({ ok: true, date, closed })
  } catch (error) {
    await failCronRun(run, error)
    return NextResponse.json(
      { ok: false, date, error: error instanceof Error ? error.message : 'Falha ao fechar fila' },
      { status: 500 },
    )
  }
}
