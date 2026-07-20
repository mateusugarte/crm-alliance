import { createServiceClient } from '@/lib/supabase/service'
import { sendTextMessage } from '@/lib/whatsapp/send'
import { toWhatsAppNumber } from '@/lib/format-phone'
import { getIO } from '@/lib/disparo/socket'

interface RunnerState {
  paused: boolean
  stopped: boolean
}

interface CampaignRow {
  status: string
  instance_id: string
  interval_min: number
  interval_max: number
  allowed_hours_start: number
  allowed_hours_end: number
}

interface DispatchRow {
  id: string
  phone: string
  message_sent: string | null
  typing_delay: number | null
}

interface ReactivationCampaignRow {
  status: string
  instance_id: string
  allowed_hours_start: number
  allowed_hours_end: number
}

interface ReactivationDispatchRow {
  id: string
  phone: string
  message_sent: string | null
  typing_delay: number | null
  interval_delay_ms: number | null
}

const campaignRunners = new Map<string, RunnerState>()
const reactivationRunners = new Map<string, RunnerState>()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function randomIntervalMs(intervalMin: number, intervalMax: number): number {
  const minutes = randomBetween(intervalMin, intervalMax)
  const seconds = Math.floor(Math.random() * 60)
  const ms = Math.floor(Math.random() * 1000)
  return minutes * 60 * 1000 + seconds * 1000 + ms
}

/** Bloqueia (sem consumir a fila) enquanto o horário atual estiver fora da janela permitida. */
async function waitForAllowedHours(start: number, end: number, runner: RunnerState): Promise<void> {
  while (!runner.stopped) {
    const hour = new Date().getHours()
    if (hour >= start && hour <= end) return
    await sleep(60_000)
  }
}

/** Espera `ms`, emitindo countdown a cada segundo. Pausa congela a contagem sem descartá-la. */
async function waitWithCountdown(
  ms: number,
  runner: RunnerState,
  emit: (remaining: number, total: number) => void,
): Promise<void> {
  const total = ms
  let remaining = ms
  while (remaining > 0) {
    if (runner.stopped) return
    if (runner.paused) {
      await sleep(500)
      continue
    }
    emit(remaining, total)
    const step = Math.min(1000, remaining)
    await sleep(step)
    remaining -= step
  }
  if (!runner.stopped) emit(0, total)
}

// ── Campanhas normais ───────────────────────────────────────────────────────

async function runCampaignLoop(campaignId: string): Promise<void> {
  const service = createServiceClient()

  try {
    while (true) {
      const runner = campaignRunners.get(campaignId)
      if (!runner || runner.stopped) return

      if (runner.paused) {
        await sleep(500)
        continue
      }

      const { data: campaignRaw } = await service
        .from('campaigns')
        .select('status, instance_id, interval_min, interval_max, allowed_hours_start, allowed_hours_end')
        .eq('id', campaignId)
        .single()
      const campaign = campaignRaw as CampaignRow | null
      if (!campaign || campaign.status !== 'running') return

      await waitForAllowedHours(campaign.allowed_hours_start, campaign.allowed_hours_end, runner)
      if (runner.stopped) return

      const { data: nextRaw } = await service
        .from('dispatches')
        .select('id, phone, message_sent, typing_delay')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const next = nextRaw as DispatchRow | null

      if (!next) {
        await service.from('campaigns').update({ status: 'completed' } as never).eq('id', campaignId)
        getIO()?.emit('campaign:completed', { campaignId })
        return
      }

      if (!next.message_sent) {
        await service.from('dispatches')
          .update({ status: 'failed', error: 'Mensagem não preparada' } as never)
          .eq('id', next.id)
        await service.rpc('increment_campaign_failed', { p_campaign_id: campaignId } as never)
        getIO()?.emit('campaign:dispatch:failed', { dispatch_id: next.id, error: 'Mensagem não preparada' })
        continue
      }

      const result = await sendTextMessage(
        campaign.instance_id,
        toWhatsAppNumber(next.phone),
        next.message_sent,
        next.typing_delay ?? undefined,
      )

      if (result.success) {
        await service.from('dispatches')
          .update({ status: 'sent', sent_at: new Date().toISOString() } as never)
          .eq('id', next.id)
        await service.rpc('increment_campaign_sent', { p_campaign_id: campaignId } as never)
        getIO()?.emit('campaign:dispatch:sent', { dispatch_id: next.id })
      } else {
        await service.from('dispatches')
          .update({ status: 'failed', error: result.error ?? null } as never)
          .eq('id', next.id)
        await service.rpc('increment_campaign_failed', { p_campaign_id: campaignId } as never)
        getIO()?.emit('campaign:dispatch:failed', { dispatch_id: next.id, error: result.error })
      }

      const delay = randomIntervalMs(campaign.interval_min, campaign.interval_max)
      await waitWithCountdown(delay, runner, (remaining, total) => {
        getIO()?.emit('campaign:countdown', { campaignId, remaining, total })
      })
    }
  } catch (err) {
    console.error(`[disparo-engine] Erro no loop da campanha ${campaignId}:`, err)
  } finally {
    campaignRunners.delete(campaignId)
  }
}

export async function startCampaign(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const existing = campaignRunners.get(campaignId)

  if (existing) {
    existing.paused = false
    existing.stopped = false
  } else {
    campaignRunners.set(campaignId, { paused: false, stopped: false })
  }

  await service.from('campaigns').update({ status: 'running' } as never).eq('id', campaignId)
  getIO()?.emit('campaign:started', { campaignId })

  if (!existing) runCampaignLoop(campaignId)
}

export async function pauseCampaign(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const runner = campaignRunners.get(campaignId)
  if (runner) runner.paused = true

  await service.from('campaigns').update({ status: 'paused' } as never).eq('id', campaignId)
  getIO()?.emit('campaign:paused', { campaignId })
}

export async function stopCampaign(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const runner = campaignRunners.get(campaignId)
  if (runner) runner.stopped = true
  campaignRunners.delete(campaignId)

  await service.from('campaigns').update({ status: 'cancelled' } as never).eq('id', campaignId)
  getIO()?.emit('campaign:stopped', { campaignId })
}

// ── Reativação ───────────────────────────────────────────────────────────────

async function runReactivationLoop(campaignId: string): Promise<void> {
  const service = createServiceClient()

  try {
    while (true) {
      const runner = reactivationRunners.get(campaignId)
      if (!runner || runner.stopped) return

      if (runner.paused) {
        await sleep(500)
        continue
      }

      const { data: campaignRaw } = await service
        .from('reactivation_campaigns')
        .select('status, instance_id, allowed_hours_start, allowed_hours_end')
        .eq('id', campaignId)
        .single()
      const campaign = campaignRaw as ReactivationCampaignRow | null
      if (!campaign || campaign.status !== 'running') return

      await waitForAllowedHours(campaign.allowed_hours_start, campaign.allowed_hours_end, runner)
      if (runner.stopped) return

      const { data: nextRaw } = await service
        .from('reactivation_dispatches')
        .select('id, phone, message_sent, typing_delay, interval_delay_ms')
        .eq('reactivation_campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const next = nextRaw as ReactivationDispatchRow | null

      if (!next) {
        await service.from('reactivation_campaigns').update({ status: 'completed' } as never).eq('id', campaignId)
        getIO()?.emit('reactivation:completed', { campaignId })
        return
      }

      if (!next.message_sent) {
        await service.from('reactivation_dispatches')
          .update({ status: 'failed', error: 'Mensagem não preparada' } as never)
          .eq('id', next.id)
        await service.rpc('increment_reactivation_failed', { p_campaign_id: campaignId } as never)
        getIO()?.emit('reactivation:dispatch:failed', { campaignId, dispatchId: next.id, phone: next.phone, error: 'Mensagem não preparada' })
        continue
      }

      const result = await sendTextMessage(
        campaign.instance_id,
        toWhatsAppNumber(next.phone),
        next.message_sent,
        next.typing_delay ?? undefined,
      )

      if (result.success) {
        await service.from('reactivation_dispatches')
          .update({ status: 'sent', sent_at: new Date().toISOString() } as never)
          .eq('id', next.id)
        await service.rpc('increment_reactivation_sent', { p_campaign_id: campaignId } as never)
        getIO()?.emit('reactivation:dispatch:sent', { campaignId, dispatchId: next.id, phone: next.phone, message: next.message_sent })
      } else {
        await service.from('reactivation_dispatches')
          .update({ status: 'failed', error: result.error ?? null } as never)
          .eq('id', next.id)
        await service.rpc('increment_reactivation_failed', { p_campaign_id: campaignId } as never)
        getIO()?.emit('reactivation:dispatch:failed', { campaignId, dispatchId: next.id, phone: next.phone, error: result.error })
      }

      const delay = next.interval_delay_ms ?? randomIntervalMs(2, 5)
      await waitWithCountdown(delay, runner, (remaining, total) => {
        getIO()?.emit('reactivation:countdown', { campaignId, remaining, total })
      })
    }
  } catch (err) {
    console.error(`[disparo-engine] Erro no loop de reativação ${campaignId}:`, err)
  } finally {
    reactivationRunners.delete(campaignId)
  }
}

export async function startReactivation(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const existing = reactivationRunners.get(campaignId)

  if (existing) {
    existing.paused = false
    existing.stopped = false
  } else {
    reactivationRunners.set(campaignId, { paused: false, stopped: false })
  }

  await service.from('reactivation_campaigns').update({ status: 'running' } as never).eq('id', campaignId)
  getIO()?.emit('reactivation:started', { campaignId })

  if (!existing) runReactivationLoop(campaignId)
}

export async function pauseReactivation(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const runner = reactivationRunners.get(campaignId)
  if (runner) runner.paused = true

  await service.from('reactivation_campaigns').update({ status: 'paused' } as never).eq('id', campaignId)
  getIO()?.emit('reactivation:paused', { campaignId })
}

export async function stopReactivation(campaignId: string): Promise<void> {
  const service = createServiceClient()
  const runner = reactivationRunners.get(campaignId)
  if (runner) runner.stopped = true
  reactivationRunners.delete(campaignId)

  await service.from('reactivation_campaigns').update({ status: 'cancelled' } as never).eq('id', campaignId)
  getIO()?.emit('reactivation:stopped', { campaignId })
}

// ── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Chamada uma vez quando o servidor sobe (via src/instrumentation.ts).
 * Retoma automaticamente qualquer campanha/reativação que ficou com status
 * 'running' no banco — por exemplo após um deploy ou restart do container.
 */
export async function resumeActiveCampaigns(): Promise<void> {
  const service = createServiceClient()

  const { data: campaigns } = await service.from('campaigns').select('id').eq('status', 'running')
  for (const c of (campaigns ?? []) as { id: string }[]) {
    if (!campaignRunners.has(c.id)) {
      campaignRunners.set(c.id, { paused: false, stopped: false })
      runCampaignLoop(c.id)
    }
  }

  const { data: reactivations } = await service.from('reactivation_campaigns').select('id').eq('status', 'running')
  for (const r of (reactivations ?? []) as { id: string }[]) {
    if (!reactivationRunners.has(r.id)) {
      reactivationRunners.set(r.id, { paused: false, stopped: false })
      runReactivationLoop(r.id)
    }
  }
}
