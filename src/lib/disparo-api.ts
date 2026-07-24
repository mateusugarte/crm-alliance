/**
 * disparoFetch — wraps fetch para as rotas do sistema de disparos.
 *
 * Sempre relativo à própria origem. Quando este deploy roda na Vercel (serverless,
 * sem o processo persistente do server.js), o next.config.ts encaminha as ações
 * start/pause/stop para o EasyPanel via rewrite — o browser continua chamando o
 * mesmo domínio, então cookies de sessão seguem normalmente (sem CORS).
 */
export function disparoFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
