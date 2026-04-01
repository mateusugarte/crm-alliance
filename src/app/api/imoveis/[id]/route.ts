import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ImovelUpdate = Database['public']['Tables']['imoveis']['Update']

async function requireAdm(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data as { role: string } | null)?.role === 'adm'
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdm = await requireAdm(supabase, user.id)
  if (!isAdm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as Partial<ImovelUpdate>

  const update: ImovelUpdate = {
    ...(body.nome !== undefined && { nome: body.nome }),
    ...(body.metragem !== undefined && { metragem: body.metragem }),
    ...(body.quartos !== undefined && { quartos: body.quartos }),
    ...(body.suites !== undefined && { suites: body.suites }),
    ...(body.diferenciais !== undefined && { diferenciais: body.diferenciais }),
    ...(body.valor_min !== undefined && { valor_min: body.valor_min }),
    ...(body.valor_max !== undefined && { valor_max: body.valor_max }),
    ...(body.disponivel !== undefined && { disponivel: body.disponivel }),
    ...(body.pavimento !== undefined && { pavimento: body.pavimento }),
    ...(body.numero_unidade !== undefined && { numero_unidade: body.numero_unidade }),
    ...(body.cobertura !== undefined && { cobertura: body.cobertura }),
  }

  const { data, error } = await supabase
    .from('imoveis')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdm = await requireAdm(supabase, user.id)
  if (!isAdm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { error } = await supabase
    .from('imoveis')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
