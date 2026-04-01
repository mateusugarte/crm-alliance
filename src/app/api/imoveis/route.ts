import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ImovelInsert = Database['public']['Tables']['imoveis']['Insert']

async function requireAdm(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data as { role: string } | null)?.role === 'adm'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdm = await requireAdm(supabase, user.id)
  if (!isAdm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as Partial<ImovelInsert>

  if (!body.nome?.trim() || !body.metragem || !body.quartos || body.suites === undefined) {
    return NextResponse.json({ error: 'nome, metragem, quartos e suites são obrigatórios' }, { status: 400 })
  }

  const insert: ImovelInsert = {
    id: crypto.randomUUID(),
    nome: body.nome.trim(),
    metragem: body.metragem,
    quartos: body.quartos,
    suites: body.suites,
    diferenciais: body.diferenciais ?? [],
    valor_min: body.valor_min ?? null,
    valor_max: body.valor_max ?? null,
    disponivel: body.disponivel ?? true,
  }

  const { data, error } = await supabase
    .from('imoveis')
    .insert(insert as never)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
