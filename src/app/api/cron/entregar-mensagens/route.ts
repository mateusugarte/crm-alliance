import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron, unauthorizedCron } from '@/lib/central-do-dia/cron'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return unauthorizedCron()
  const delivery = await deliverPendingGroupMessages()
  return NextResponse.json({ ok: true, delivery })
}
