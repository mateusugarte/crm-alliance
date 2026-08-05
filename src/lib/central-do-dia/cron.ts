import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'

function secretMatches(received: string | null, expected: string) {
  if (!received) return false

  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authorization = request.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  return secretMatches(bearer, secret)
    || secretMatches(request.headers.get('x-cron-secret'), secret)
}
export function unauthorizedCron() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function localDate(reference = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(reference)
}

export function localHour(reference = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).format(reference))
}
