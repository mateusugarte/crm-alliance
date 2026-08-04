import Image from 'next/image'
import { Suspense } from 'react'
import { DateFilter } from '@/components/ui/date-filter'

/**
 * Faixa de abertura do Dashboard.
 *
 * O CRM existe para vender 34 unidades de um empreendimento de alto padrão e,
 * até aqui, o produto não aparecia em lugar nenhum da interface — nem no
 * catálogo de imóveis. Esta faixa coloca o La Reserva na primeira coisa que o
 * corretor vê, e de quebra resolve a abertura anterior, que era um título
 * solto sobre fundo cinza.
 *
 * O render é o de hora azul: o céu casa com o azul da marca e é escuro o
 * bastante para texto branco sem precisar de um véu preto por cima. As luzes
 * quentes das janelas são a origem do token `--accent-warm`.
 */
interface DashboardHeroProps {
  greeting: string
  userName: string
  dateLabel: string
  totalLeads: number
}

export function DashboardHero({ greeting, userName, dateLabel, totalLeads }: DashboardHeroProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-panel)] elev-sm">
      <Image
        src="/brand/la-reserva-hero.jpg"
        alt="Fachada do La Reserva ao entardecer"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_38%]"
      />

      {/* Escurece a esquerda para o texto e preserva o prédio à direita.
          Dois gradientes: um horizontal para leitura, um vertical para
          assentar a faixa no fundo da página. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, oklch(0.16 0.05 264 / 0.94) 0%, oklch(0.16 0.05 264 / 0.78) 34%, oklch(0.16 0.05 264 / 0.18) 72%, transparent 100%)',
        }}
      />

      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-7 py-7">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {greeting}, {userName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/70">
            {/* `capitalize` deixava "Segunda-Feira, 3 De Agosto" — o date-fns
                em pt-BR já devolve tudo minúsculo, e só a primeira letra sobe. */}
            <span className="first-letter:uppercase">{dateLabel}</span>
            <span aria-hidden className="text-white/30">·</span>
            <span className="tabular-nums">{totalLeads.toLocaleString('pt-BR')} leads na base</span>
            <span aria-hidden className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-warm)]" />
              Sistema online
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="text-sm text-white/60 sm:text-right">
            <span className="block font-medium tracking-tight text-white">La Reserva</span>
            Castelo, ES · 34 unidades
          </div>
          <Suspense fallback={null}>
            <DateFilter onDark />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
