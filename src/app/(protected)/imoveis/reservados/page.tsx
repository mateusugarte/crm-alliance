import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ImovelReservadosClient } from '@/components/imoveis/imovel-reservados-client'
import type { Imovel, Venda, UserProfile } from '@/lib/supabase/types'

async function getUserRole(): Promise<'adm' | 'corretor'> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'corretor'
    const { data } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    return (data as UserProfile | null)?.role ?? 'corretor'
  } catch {
    return 'corretor'
  }
}

async function getReservados(): Promise<Imovel[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('imoveis')
      .select('*')
      .eq('disponivel', false)
      .eq('vendido', false)
      .order('nome')
    return (data ?? []) as Imovel[]
  } catch {
    return []
  }
}

async function getVendas(): Promise<Venda[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('vendas')
      .select('*')
      .order('created_at', { ascending: false })
    return (data ?? []) as Venda[]
  } catch {
    return []
  }
}

export default async function ImoveisReservadosPage() {
  const [role, imoveis, vendas] = await Promise.all([
    getUserRole(),
    getReservados(),
    getVendas(),
  ])

  return (
    <div className="px-8 py-7 flex flex-col gap-6">
      <div>
        <Link
          href="/imoveis"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-alliance-dark transition-colors mb-4"
        >
          <ArrowLeft size={13} />
          Voltar ao catálogo
        </Link>
        <p className="text-xs font-semibold text-amber-600/80 uppercase tracking-widest mb-1">
          Catálogo
        </p>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-alliance-dark">Imóveis Reservados</h1>
          <span className="text-sm font-semibold text-gray-400">
            {imoveis.length} {imoveis.length === 1 ? 'unidade' : 'unidades'}
          </span>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Unidades indisponíveis sem venda formalizada — preencha a ficha do comprador quando a venda for confirmada.
        </p>
      </div>

      <ImovelReservadosClient imoveis={imoveis} vendas={vendas} isAdm={role === 'adm'} />
    </div>
  )
}
