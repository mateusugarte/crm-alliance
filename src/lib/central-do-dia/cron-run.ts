import { randomUUID } from 'crypto'
import { centralQuery } from './db'

type CronRunMetrics = Record<string, number | string | boolean | null | undefined>

export interface CronRun {
  id: string
  jobName: string
  referenceDate: string
}

export async function startCronRun(
  jobName: string,
  referenceDate: string,
  metadata: Record<string, unknown> = {},
): Promise<CronRun> {
  const id = randomUUID()
  await centralQuery(
    `insert into central_cron_runs (id,job_name,reference_date,status,metadata)
     values ($1,$2,$3::date,'running',$4::jsonb)`,
    [id, jobName, referenceDate, JSON.stringify(metadata)],
  )
  return { id, jobName, referenceDate }
}

export async function finishCronRun(run: CronRun, metrics: CronRunMetrics = {}) {
  await centralQuery(
    `update central_cron_runs
        set status='succeeded',finished_at=now(),metrics=$2::jsonb,error=null
      where id=$1`,
    [run.id, JSON.stringify(metrics)],
  )
}

export async function failCronRun(run: CronRun | null, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!run) return

  try {
    await centralQuery(
      `update central_cron_runs
          set status='failed',finished_at=now(),error=$2
        where id=$1`,
      [run.id, message.slice(0, 2_000)],
    )
  } catch (loggingError) {
    console.error('[central-do-dia] falha ao registrar erro do cron', loggingError)
  }
}
