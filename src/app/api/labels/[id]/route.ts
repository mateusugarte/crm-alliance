import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Only creator or adm can delete
  type LabelRow = { created_by: string | null }
  const { data: labelData } = await (supabase
    .from('labels')
    .select('created_by')
    .eq('id', id)
    .single() as unknown as Promise<{ data: LabelRow | null; error: unknown }>)

  if (!labelData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (labelData.created_by !== user.id) {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const profile = profileData as { role: 'adm' | 'corretor' } | null
    if (profile?.role !== 'adm') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('labels').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { deleted: true } })
}
