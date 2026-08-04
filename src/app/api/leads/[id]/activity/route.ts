import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

type ActivityRow = {
  id: string
  actor_id: string | null
  tipo: LeadActivityItem['type']
  titulo: string
  descricao: string | null
  metadata: Json
  criada_em: string
}

type ActorRow = { id: string; full_name: string }

export interface LeadActivityItem {
  id: string
  type: 'ligacao' | 'ligacao_desfeita' | 'reuniao_marcada' | 'retorno_agendado' | 'retentativa_agendada' | 'mudanca_estagio' | 'comentario' | 'sistema'
  title: string
  description: string | null
  metadata: Json
  createdAt: string
  actorName: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('lead_activity_events')
    .select('id, actor_id, tipo, titulo, descricao, metadata, criada_em')
    .eq('lead_id', id)
    .is('desfeita_em', null)
    .order('criada_em', { ascending: false })
    .limit(80)

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar o historico do lead' }, { status: 500 })
  }

  const activityRows = (data ?? []) as unknown as ActivityRow[]
  const actorIds = Array.from(new Set(activityRows.flatMap(item => item.actor_id ? [item.actor_id] : [])))
  const { data: actors } = actorIds.length
    ? await supabase.from('user_profiles').select('id, full_name').in('id', actorIds)
    : { data: [] }
  const actorMap = new Map(((actors ?? []) as unknown as ActorRow[]).map(actor => [actor.id, actor.full_name]))

  const activities: LeadActivityItem[] = activityRows.map(item => ({
    id: item.id,
    type: item.tipo,
    title: item.titulo,
    description: item.descricao,
    metadata: item.metadata,
    createdAt: item.criada_em,
    actorName: item.actor_id ? actorMap.get(item.actor_id) ?? 'Equipe Alliance' : null,
  }))

  return NextResponse.json({ data: activities })
}
