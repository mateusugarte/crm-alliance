import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ImovelUpdate = Database['public']['Tables']['imoveis']['Update']

// PUT /api/imoveis/[id] — atualiza imóvel (adm only)
export async function PUT(
  request: NextRequest,
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

  const body = await request.json() as {
    nome?: string
    metragem?: number
    quartos?: number
    suites?: number
    diferenciais?: string[]
    valor_min?: number | null
    valor_max?: number | null
    disponivel?: boolean
  }

  const update: ImovelUpdate = {}

  if (body.nome !== undefined) update.nome = body.nome.trim()
  if (body.metragem !== undefined) update.metragem = body.metragem
  if (body.quartos !== undefined) update.quartos = body.quartos
  if (body.suites !== undefined) update.suites = body.suites
  if (body.diferenciais !== undefined) update.diferenciais = body.diferenciais
  if (body.valor_min !== undefined) update.valor_min = body.valor_min
  if (body.valor_max !== undefined) update.valor_max = body.valor_max
  if (body.disponivel !== undefined) update.disponivel = body.disponivel

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('imoveis')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[PUT /api/imoveis/[id]] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE /api/imoveis/[id] — deleta imóvel (adm only)
export async function DELETE(
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

  const { error } = await supabase
    .from('imoveis')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/imoveis/[id]] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { id } })
}
