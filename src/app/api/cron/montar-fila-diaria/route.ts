import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { generatePendingBriefings } from '@/lib/central-do-dia/briefing'
import { authorizeCron, localDate, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { deliverPendingGroupMessages, queueDailyFollowupMessage } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()

  const date = localDate()
  const { rows } = await centralQuery('select * from montar_fila_diaria($1::date)', [date])
  const briefings = await generatePendingBriefings()
  const notification = await queueDailyFollowupMessage(date)
  const delivery = await deliverPendingGroupMessages()
  return NextResponse.json({ ok: true, date, tasks: rows.length, briefings, notification, delivery })
}
