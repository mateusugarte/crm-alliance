import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { authorizeCron, localDate, localHour, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { failCronRun, finishCronRun, startCronRun, type CronRun } from '@/lib/central-do-dia/cron-run'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()

  let run: CronRun | null = null
  try {
    run = await startCronRun('entregar-mensagens', localDate())
    const messageId = request.nextUrl.searchParams.get('messageId') || undefined
    const hour = localHour()
    const escalated = hour >= 8 && hour < 20
      ? (await centralQuery<{ total: number }>('select verificar_prazos()::int total')).rows[0]?.total ?? 0
      : 0
    const delivery = await deliverPendingGroupMessages(10, messageId)
    await finishCronRun(run, { ...delivery, escalated })
    return NextResponse.json({ ok: true, escalated, delivery })
  } catch (error) {
    await failCronRun(run, error)
    console.error('[central-do-dia] entrega do WhatsApp falhou', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Falha ao entregar mensagens' },
      { status: 500 },
    )
  }
}
