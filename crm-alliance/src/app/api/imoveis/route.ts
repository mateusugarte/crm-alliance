import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database, Imovel } from '@/lib/supabase/types'

type ImovelInsert = Database['public']['Tables']['imoveis']['Insert']

// GET /api/imoveis — lista todos os imóveis ordenados por nome
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('nome', { ascending: true })

  if (error) {
    console.error('[GET /api/imoveis] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data ?? []) as Imovel[] })
}

// POST /api/imoveis — cria imóvel (adm only)
export async function POST(request: NextRequest) {
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

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'nome is required' }, { status: 400 })
  }
  if (body.metragem == null || body.quartos == null || body.suites == null) {
    return NextResponse.json({ error: 'metragem, quartos and suites are required' }, { status: 400 })
  }

  // Gera ID no formato "apto-XX" ou "cob-XX" baseado no nome
  const nomeLower = body.nome.toLowerCase()
  const prefix = nomeLower.includes('cobertura') || nomeLower.includes('cob') ? 'cob' : 'apto'
  const suffix = String(Math.floor(Math.random() * 900) + 100) // 100-999
  const generatedId = `${prefix}-${suffix}`

  const insert: ImovelInsert = {
    id: generatedId,
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

  if (error) {
    console.error('[POST /api/imoveis] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data as Imovel }, { status: 201 })
}
