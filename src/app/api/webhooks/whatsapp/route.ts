import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// GET — verificação do webhook Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — receber mensagens da Meta
export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  const signature = request.headers.get('x-hub-signature-256')

  if (!appSecret) {
    return NextResponse.json({ error: 'WHATSAPP_APP_SECRET not configured' }, { status: 500 })
  }

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 403 })
  }

  const body = await request.text()
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // Repassar ao N8N
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET

  if (n8nUrl) {
    await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(n8nSecret ? { 'x-webhook-secret': n8nSecret } : {}),
      },
      body,
    })
  }

  return NextResponse.json({ status: 'ok' })
}
