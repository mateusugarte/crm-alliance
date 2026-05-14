const DISPARO_API = process.env.NEXT_PUBLIC_DISPARO_API_URL || 'http://localhost:3001'

export function disparoFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DISPARO_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
