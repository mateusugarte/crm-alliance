import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database, Label } from '@/lib/supabase/types'

type LabelInsert = Database['public']['Tables']['labels']['Insert']

// GET /api/labels — lista todas as etiquetas ordenadas por nome
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[GET /api/labels] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data ?? []) as Label[] })
}

// POST /api/labels — cria nova etiqueta
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { name?: string; color?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const insert: LabelInsert = {
    name: body.name.trim(),
    color: body.color?.trim() ?? '#1E90FF',
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('labels')
    .insert(insert as never)
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/labels] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data as Label }, { status: 201 })
}
