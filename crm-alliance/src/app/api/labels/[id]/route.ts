import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/labels/[id] — deleta etiqueta (criador ou adm)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verificar se a label existe e quem a criou
  const { data: labelData } = await supabase
    .from('labels')
    .select('id, created_by')
    .eq('id', id)
    .single()

  const label = labelData as { id: string; created_by: string | null } | null

  if (!label) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verificar permissão: criador ou adm
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'adm' | 'corretor' } | null

  if (label.created_by !== user.id && profile?.role !== 'adm') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('labels')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/labels/[id]] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { id } })
}
