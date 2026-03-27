import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

const VALID_STAGES = ['lead_frio', 'lead_morno', 'lead_quente', 'follow_up', 'reuniao_agendada', 'visita_confirmada', 'cliente'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { stage?: string }

  if (!body.stage || !VALID_STAGES.includes(body.stage as typeof VALID_STAGES[number])) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  const update: LeadUpdate = { stage: body.stage as LeadUpdate['stage'], updated_at: new Date().toISOString() }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('leads') as any).update(update).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id, stage: body.stage } })
}
