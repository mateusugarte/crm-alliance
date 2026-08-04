import { NextRequest, NextResponse } from 'next/server'
import { centralQuery } from '@/lib/central-do-dia/db'
import { authorizeCron, localHour, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()
  const hour = localHour()
  if (hour < 8 || hour >= 20) return NextResponse.json({ ok: true, skipped: 'fora_do_horario' })

  const { rows } = await centralQuery<{ total: number }>('select verificar_prazos()::int total')
  const delivery = await deliverPendingGroupMessages()
  return NextResponse.json({ ok: true, escalated: rows[0]?.total ?? 0, delivery })
}
