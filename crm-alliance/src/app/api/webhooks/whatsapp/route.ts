import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// GET — verificacao do webhook Meta
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

  // SEC-02: fail-safe — rejeitar se APP_SECRET nao estiver configurado em producao
  if (!appSecret) {
    console.error('[webhook/whatsapp] WHATSAPP_APP_SECRET nao configurado — rejeitando POST')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  const body = await request.text()

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 403 })
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')

  // timingSafeEqual exige buffers do mesmo tamanho
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // Repassar ao N8N
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET

  if (n8nUrl) {
    try {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(n8nSecret ? { 'x-webhook-secret': n8nSecret } : {}),
        },
        body,
      })
    } catch (err) {
      console.error('[webhook/whatsapp] Falha ao repassar para N8N:', err)
    }
  }

  return NextResponse.json({ status: 'ok' })
}
