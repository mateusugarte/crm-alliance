import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdm(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data as { role: string } | null)?.role === 'adm'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdm = await requireAdm(supabase, user.id)
  if (!isAdm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as Record<string, unknown>

  if (!body.comprador_nome || !body.comprador_telefone || !body.unidade_comprada) {
    return NextResponse.json({ error: 'comprador_nome, comprador_telefone e unidade_comprada são obrigatórios' }, { status: 400 })
  }

  // Insere venda
  const { data: venda, error: vendaError } = await supabase
    .from('vendas')
    .insert({
      imovel_id: id,
      comprador_nome: body.comprador_nome as string,
      comprador_telefone: body.comprador_telefone as string,
      comprador_email: (body.comprador_email as string | null) ?? null,
      unidade_comprada: body.unidade_comprada as string,
      tem_entrada: (body.tem_entrada as boolean) ?? false,
      valor_entrada: (body.valor_entrada as number | null) ?? null,
      tem_financiamento: (body.tem_financiamento as boolean) ?? false,
      valor_financiado: (body.valor_financiado as number | null) ?? null,
      parcelas_financiamento: (body.parcelas_financiamento as number | null) ?? null,
      tem_parcelamento_direto: (body.tem_parcelamento_direto as boolean) ?? false,
      parcelas_direto: (body.parcelas_direto as number | null) ?? null,
      valor_parcela_direto: (body.valor_parcela_direto as number | null) ?? null,
      created_by: user.id,
    } as never)
    .select('*')
    .single()

  if (vendaError) return NextResponse.json({ error: vendaError.message }, { status: 500 })

  // Marca imóvel como vendido
  const { error: imovelError } = await supabase
    .from('imoveis')
    .update({ vendido: true, disponivel: false } as never)
    .eq('id', id)

  if (imovelError) return NextResponse.json({ error: imovelError.message }, { status: 500 })

  return NextResponse.json({ data: venda }, { status: 201 })
}
