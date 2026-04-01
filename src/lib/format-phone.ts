/**
 * Formata número de telefone vindo do WhatsApp/Supabase
 * Ex: "5511994800080@s.whatsapp.net" → "55 11994800080"
 * Ex: "5511994800080" → "55 11994800080"
 */
export function formatPhone(raw: string): string {
  // Remove sufixo do WhatsApp
  const cleaned = raw.split('@')[0]
  // Mantém apenas dígitos
  const digits = cleaned.replace(/\D/g, '')
  // Se começa com 55 (Brasil), formata como "55 [número]"
  if (digits.startsWith('55') && digits.length >= 12) {
    return `55 ${digits.slice(2)}`
  }
  return digits
}
