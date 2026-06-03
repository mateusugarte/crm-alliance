import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const [{ data: campaign, error: campErr }, { data: dispatches }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', id).single(),
    supabase.from('dispatches').select('*').eq('campaign_id', id).order('created_at'),
  ])

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  }

  const c = campaign as Record<string, unknown>
  return NextResponse.json({ ...c, dispatches: dispatches ?? [] })
}
