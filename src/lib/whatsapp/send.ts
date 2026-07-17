// Fallback para o endpoint real da UazAPI usado em produção — pode ser sobrescrito por env var.
const BASE_URL = process.env.UAZAPI_BASE_URL || 'https://getmore.uazapi.com'

interface SendTextResult {
  success: boolean
  wa_message_id?: string
  error?: string
}

/**
 * Envia mensagem de texto via UazAPI.
 * `instanceToken` é o token da instância conectada (armazenado em wa_instances.instance_id).
 */
export async function sendTextMessage(
  instanceToken: string,
  to: string,
  text: string
): Promise<SendTextResult> {
  const res = await fetch(`${BASE_URL}/send/text`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      token: instanceToken,
    },
    body: JSON.stringify({ number: to, text }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `${res.status} ${res.statusText}: ${err}` }
  }

  const data = await res.json() as { id?: string; messageid?: string; key?: { id?: string } }
  return { success: true, wa_message_id: data.id ?? data.messageid ?? data.key?.id }
}
