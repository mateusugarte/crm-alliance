import { NextRequest, NextResponse } from 'next/server'

export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
    || request.headers.get('x-cron-secret') === secret
}
export function unauthorizedCron() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function localHour() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()))
}
