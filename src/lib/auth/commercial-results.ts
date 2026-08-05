const COMMERCIAL_RESULTS_EMAILS = new Set([
  'joao@alliance.com.br',
  'lucas@alliance.com.br',
])

export function canViewCommercialResults(role?: string | null, email?: string | null) {
  if (role === 'adm') return true
  return COMMERCIAL_RESULTS_EMAILS.has(email?.trim().toLowerCase() ?? '')
}
