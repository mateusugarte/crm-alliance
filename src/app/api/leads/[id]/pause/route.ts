import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: lead } = await supabase
    .from('leads')
    .select('automation_paused')
    .eq('id', id)
    .single()

  const currentLead = lead as { automation_paused: boolean } | null
  const newState = !currentLead?.automation_paused

  const update: LeadUpdate = { automation_paused: newState, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('leads')
    .update(update as never)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id, automation_paused: newState } })
}
