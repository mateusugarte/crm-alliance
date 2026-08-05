import { Pool, type QueryResultRow } from 'pg'

const globalForCentral = globalThis as typeof globalThis & {
  centralPool?: Pool
}
function getPool() {
  if (!process.env.PG_MEMORY_URL) {
    throw new Error('PG_MEMORY_URL nao configurada')
  }

  const sslCaBase64 = process.env.PG_SSL_CA_BASE64
  if (process.env.NODE_ENV === 'production' && !sslCaBase64) {
    throw new Error('PG_SSL_CA_BASE64 nao configurada')
  }

  if (!globalForCentral.centralPool) {
    globalForCentral.centralPool = new Pool({
      connectionString: process.env.PG_MEMORY_URL,
      ssl: sslCaBase64
        ? {
            ca: Buffer.from(sslCaBase64, 'base64').toString('utf8'),
            rejectUnauthorized: true,
          }
        : { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 20_000,
    })
  }

  return globalForCentral.centralPool
}

export async function centralQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getPool().query<T>(text, values)
}
