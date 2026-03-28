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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('badge_color')
    .eq('id', user.id)
    .single()

  const update: LeadUpdate = { assigned_to: user.id, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('leads')
    .update(update as never)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id, assigned_to: user.id, badge_color: (profile as { badge_color: string } | null)?.badge_color ?? '#0A2EAD' } })
}
