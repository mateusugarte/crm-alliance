import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'adm' | 'corretor' } | null
  if (profile?.role !== 'adm') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data: imovelData } = await supabase
    .from('imoveis')
    .select('disponivel')
    .eq('id', id)
    .single()

  const imovel = imovelData as { disponivel: boolean } | null
  if (!imovel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newState = !imovel.disponivel

  const { error } = await supabase
    .from('imoveis')
    .update({ disponivel: newState } as never)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id, disponivel: newState } })
}
