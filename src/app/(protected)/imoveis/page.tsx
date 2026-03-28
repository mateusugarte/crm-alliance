import PageTransition from '@/components/layout/page-transition'
import { ImovelGrid } from '@/components/imoveis/imovel-grid'
import { IMOVEIS_LA_RESERVA } from '@/components/imoveis/imovel-data'

export default function ImoveisPage() {
  return (
    <PageTransition>
      <div className="px-8 py-7 flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Catálogo
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark">Imóveis La Reserva</h1>
          <p className="text-gray-400 text-sm mt-1">Castelo, ES — 34 unidades exclusivas de alto padrão</p>
        </div>
        <ImovelGrid imoveis={IMOVEIS_LA_RESERVA} />
      </div>
    </PageTransition>
  )
}
