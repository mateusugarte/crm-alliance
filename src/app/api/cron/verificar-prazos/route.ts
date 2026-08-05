import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { authorizeCron, localDate, localHour, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { failCronRun, finishCronRun, startCronRun, type CronRun } from '@/lib/central-do-dia/cron-run'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()
  const hour = localHour()
  if (hour < 8 || hour >= 20) return NextResponse.json({ ok: true, skipped: 'fora_do_horario' })

  let run: CronRun | null = null
  try {
    run = await startCronRun('verificar-prazos', localDate())
    const { rows } = await centralQuery<{ total: number }>('select verificar_prazos()::int total')
    const delivery = await deliverPendingGroupMessages()
    const escalated = rows[0]?.total ?? 0
    await finishCronRun(run, { escalated, sent: delivery.sent, failed: delivery.failed })
    return NextResponse.json({ ok: true, escalated, delivery })
  } catch (error) {
    await failCronRun(run, error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Falha ao verificar prazos' },
      { status: 500 },
    )
  }
}
