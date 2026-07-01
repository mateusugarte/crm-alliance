const BASE_URL = process.env.UAZAPI_BASE_URL

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
  if (!BASE_URL) {
    return { success: false, error: 'UAZAPI_BASE_URL not configured' }
  }

  const res = await fetch(`${BASE_URL}/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token: instanceToken,
    },
    body: JSON.stringify({ number: to, text }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }

  const data = await res.json() as { id?: string; messageid?: string; key?: { id?: string } }
  return { success: true, wa_message_id: data.id ?? data.messageid ?? data.key?.id }
}
