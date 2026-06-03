import { createServiceClient } from '@/lib/supabase/service'

const DISPARO_LABEL_PREFIX = 'Disparo '
const DISPARO_LABEL_SUFFIX = '×'
const DISPARO_LABEL_COLOR  = '#f97316'

function parseDisparoCount(name: string): number | null {
  if (!name.startsWith(DISPARO_LABEL_PREFIX) || !name.endsWith(DISPARO_LABEL_SUFFIX)) return null
  const n = parseInt(name.slice(DISPARO_LABEL_PREFIX.length, -1), 10)
  return isNaN(n) ? null : n
}

function disparoLabelName(count: number): string {
  return `${DISPARO_LABEL_PREFIX}${count}${DISPARO_LABEL_SUFFIX}`
}

export async function updateDisparoLabels(
  service: ReturnType<typeof createServiceClient>,
  leadIds: string[],
) {
  if (!leadIds.length) return

  const { data: allLabels } = await service.from('labels').select('id, name')
  const typed = (allLabels ?? []) as { id: string; name: string }[]
  const countLabels = typed.filter(l => parseDisparoCount(l.name) !== null)
  const labelByCount = new Map(countLabels.map(l => [parseDisparoCount(l.name)!, l.id]))

  const { data: assignments } = await service
    .from('lead_labels')
    .select('lead_id, label_id')
    .in('lead_id', leadIds)

  const typed2 = (assignments ?? []) as { lead_id: string; label_id: string }[]
  const leadCurrentCount = new Map<string, { labelId: string; count: number }>()
  for (const a of typed2) {
    const label = countLabels.find(l => l.id === a.label_id)
    if (label) {
      leadCurrentCount.set(a.lead_id, {
        labelId: a.label_id,
        count:   parseDisparoCount(label.name)!,
      })
    }
  }

  for (const leadId of leadIds) {
    const current  = leadCurrentCount.get(leadId)
    const newCount = (current?.count ?? 0) + 1

    if (current) {
      await service.from('lead_labels').delete()
        .eq('lead_id', leadId).eq('label_id', current.labelId)
    }

    let newLabelId = labelByCount.get(newCount)
    if (!newLabelId) {
      const { data: created } = await service
        .from('labels')
        .insert({ name: disparoLabelName(newCount), color: DISPARO_LABEL_COLOR } as never)
        .select('id')
        .single()
      if (created) {
        newLabelId = (created as { id: string }).id
        labelByCount.set(newCount, newLabelId)
      }
    }

    if (newLabelId) {
      const alreadyHas = typed2.some(a => a.lead_id === leadId && a.label_id === newLabelId)
      if (!alreadyHas) {
        await service.from('lead_labels')
          .insert({ lead_id: leadId, label_id: newLabelId } as never)
      }
    }
  }
}
