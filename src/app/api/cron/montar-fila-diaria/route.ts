import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { generatePendingBriefings } from '@/lib/central-do-dia/briefing'
import { authorizeCron, localDate, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { failCronRun, finishCronRun, startCronRun, type CronRun } from '@/lib/central-do-dia/cron-run'
import { deliverPendingGroupMessages, queueDailyFollowupMessage } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()

  const date = localDate()
  let run: CronRun | null = null

  try {
    run = await startCronRun('montar-fila-diaria', date, {
      vercelCron: request.headers.get('x-vercel-cron') === '1',
    })
    const { rows } = await centralQuery('select * from montar_fila_diaria($1::date)', [date])
    const notification = await queueDailyFollowupMessage(date)
    const delivery = await deliverPendingGroupMessages()

    // O briefing melhora a tela, mas nunca pode impedir a fila ou o WhatsApp.
    const briefings = await generatePendingBriefings()
    await finishCronRun(run, {
      tasks: rows.length,
      contacts: notification.contacts,
      queued: notification.queued,
      sent: delivery.sent,
      failed: delivery.failed,
      briefings,
    })
    return NextResponse.json({ ok: true, date, tasks: rows.length, briefings, notification, delivery })
  } catch (error) {
    await failCronRun(run, error)
    console.error('[central-do-dia] cron diario falhou', error)
    return NextResponse.json(
      { ok: false, date, error: error instanceof Error ? error.message : 'Falha ao montar fila' },
      { status: 500 },
    )
  }
}
