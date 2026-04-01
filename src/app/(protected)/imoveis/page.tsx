import { createClient } from '@/lib/supabase/server'
import { ImovelGrid } from '@/components/imoveis/imovel-grid'
import type { Imovel, UserProfile } from '@/lib/supabase/types'

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

async function getImoveis(): Promise<Imovel[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('imoveis')
      .select('*')
      .order('nome')
    return (data ?? []) as Imovel[]
  } catch {
    return []
  }
}

export default async function ImoveisPage() {
  const [role, imoveis] = await Promise.all([getUserRole(), getImoveis()])

  return (
    <div className="px-8 py-7 flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
          Catálogo
        </p>
        <h1 className="text-2xl font-bold text-alliance-dark">Imóveis La Reserva</h1>
        <p className="text-gray-400 text-sm mt-1">Castelo, ES — 34 unidades exclusivas de alto padrão</p>
      </div>
      <ImovelGrid imoveis={imoveis} isAdm={role === 'adm'} />
    </div>
  )
}
