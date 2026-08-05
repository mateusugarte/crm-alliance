// Fallback para o endpoint real da UazAPI usado em produção — pode ser sobrescrito por env var.
const BASE_URL = process.env.UAZAPI_BASE_URL || 'https://getmore.uazapi.com'
const REQUEST_TIMEOUT_MS = 15_000

interface SendTextResult {
  success: boolean
  wa_message_id?: string
  error?: string
}

/**
 * Envia mensagem de texto via UazAPI.
 * `instanceToken` é o token da instância conectada (armazenado em wa_instances.instance_id).
 * `delayMs`, quando informado, pede à UazAPI para simular "digitando..." antes de entregar.
 */
export async function sendTextMessage(
  instanceToken: string,
  to: string,
  text: string,
  delayMs?: number
): Promise<SendTextResult> {
  const body: { number: string; text: string; delay?: number } = { number: to, text }
  if (delayMs !== undefined) body.delay = delayMs

  const res = await fetch(`${BASE_URL}/send/text`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token: instanceToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    const err = (await res.text()).slice(0, 1_000)
    return { success: false, error: `${res.status} ${res.statusText}: ${err}` }
  }

  const data = await res.json().catch(() => ({})) as { id?: string; messageid?: string; key?: { id?: string } }
  return { success: true, wa_message_id: data.id ?? data.messageid ?? data.key?.id }
}

/**
 * Envia um documento (ex: PDF) via UazAPI.
 * `fileUrl` deve ser uma URL publica acessivel pela UazAPI.
 */
export async function sendDocumentMessage(
  instanceToken: string,
  to: string,
  fileUrl: string,
  caption?: string,
  delayMs?: number
): Promise<SendTextResult> {
  const body: { number: string; type: string; file: string; text?: string; delay?: number } = {
    number: to,
    type: 'document',
    file: fileUrl,
  }
  if (caption) body.text = caption
  if (delayMs !== undefined) body.delay = delayMs

  const res = await fetch(`${BASE_URL}/send/media`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token: instanceToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    const err = (await res.text()).slice(0, 1_000)
    return { success: false, error: `${res.status} ${res.statusText}: ${err}` }
  }

  const data = await res.json().catch(() => ({})) as { id?: string; messageid?: string; key?: { id?: string } }
  return { success: true, wa_message_id: data.id ?? data.messageid ?? data.key?.id }
}
