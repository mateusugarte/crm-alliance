import { Pool, type QueryResultRow } from 'pg'

const globalForCentral = globalThis as typeof globalThis & {
  centralPool?: Pool
}
function getPool() {
  if (!process.env.PG_MEMORY_URL) {
    throw new Error('PG_MEMORY_URL nao configurada')
  }

  if (!globalForCentral.centralPool) {
    globalForCentral.centralPool = new Pool({
      connectionString: process.env.PG_MEMORY_URL,
      max: 4,
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
