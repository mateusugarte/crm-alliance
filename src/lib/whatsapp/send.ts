const BASE_URL = 'https://graph.facebook.com/v21.0'

interface SendTextResult {
  success: boolean
  wa_message_id?: string
  error?: string
}

export async function sendTextMessage(to: string, body: string): Promise<SendTextResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }

  const data = await res.json() as { messages?: { id: string }[] }
  return { success: true, wa_message_id: data.messages?.[0]?.id }
}

interface SendTemplateResult {
  success: boolean
  wa_message_id?: string
  error?: string
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[]
): Promise<SendTemplateResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }

  const data = await res.json() as { messages?: { id: string }[] }
  return { success: true, wa_message_id: data.messages?.[0]?.id }
}
