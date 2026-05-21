/**
 * disparoFetch — wraps fetch para as rotas do sistema de disparos.
 *
 * Em produção as rotas vivem no próprio Next.js (/api/reactivation, etc.).
 * NEXT_PUBLIC_DISPARO_API_URL pode ser definida para apontar a um serviço externo
 * quando necessário; se não estiver definida, usa rotas internas (string vazia = relativo).
 */
const DISPARO_API = process.env.NEXT_PUBLIC_DISPARO_API_URL ?? ''

export function disparoFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DISPARO_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
