import { createClient } from '@/lib/supabase/server'
import PageTransition from '@/components/layout/page-transition'
import { ImovelGrid } from '@/components/imoveis/imovel-grid'
import { IMOVEIS_LA_RESERVA } from '@/components/imoveis/imovel-data'
import type { UserProfile } from '@/lib/supabase/types'

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

export default async function ImoveisPage() {
  const role = await getUserRole()

  return (
    <PageTransition>
      <div className="px-8 py-7 flex flex-col gap-6">
        <div>
          {/* Eyebrow: text-label semântico */}
          <p className="text-label text-alliance-blue/60 uppercase tracking-widest mb-1">
            Catálogo
          </p>
          {/* Título de página: text-title semântico */}
          <h1 className="text-title text-alliance-dark">Imóveis La Reserva</h1>
          {/* Descrição: text-body semântico */}
          <p className="text-body text-gray-400 mt-1">
            Castelo, ES — {IMOVEIS_LA_RESERVA.length} unidades exclusivas de alto padrão
          </p>
        </div>
        <ImovelGrid imoveis={IMOVEIS_LA_RESERVA} isAdm={role === 'adm'} />
      </div>
    </PageTransition>
  )
}
