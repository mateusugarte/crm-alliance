'use client'

import { BarChart3, MessageCircleReply, Send, TrendingUp, Users, ICON } from '@/lib/icons'
import type { DisparoDashboardData } from '@/app/(protected)/dashboard/page'

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function formatAverage(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/**
 * Bloco de estatística.
 *
 * O filete colorido de 2px na lateral saiu — era a terceira variação da mesma
 * faixa de acento no projeto e não comunicava nada. A cor foi para o ponto
 * junto do rótulo, onde é lida como categoria.
 */
function StatBlock({
  label,
  value,
  detail,
  accent = 'var(--brand)',
}: {
  label: string
  value: string | number
  detail?: string
  accent?: string
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 elev-sm">
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-ink">{value}</p>
      {detail && <p className="mt-1.5 text-xs text-ink-subtle">{detail}</p>}
    </div>
  )
}

export function DisparosSection({ data }: { data: DisparoDashboardData }) {
  const max = Math.max(...data.funnel.map(item => item.value), 1)

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Send size={ICON.md} />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Disparos</h2>
            <p className="text-xs text-ink-muted">Impacto, resposta e avanço no pipeline</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs text-ink-muted">
          <span className="font-semibold tabular-nums text-ink">{data.coldZeroRemaining}</span>{' '}
          leads frios sem nenhum disparo
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatBlock
          label="Leads impactados"
          value={data.impactedLeads}
          detail={`${data.totalSent} disparos enviados`}
          accent="var(--brand)"
        />
        <StatBlock
          label="Responderam"
          value={data.respondedLeads}
          detail={`${formatPercent(data.responseRate)} dos impactados`}
          accent="var(--success)"
        />
        <StatBlock
          label="Avançaram no pipeline"
          value={data.advancedLeads}
          detail={`${formatPercent(data.advanceRate)} dos impactados`}
          accent="var(--stage-morno)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <BarChart3 size={ICON.sm} className="text-ink-muted" />
              Funil de disparos
            </h3>
            <span className="text-xs text-ink-subtle">
              média de {formatAverage(data.averageDispatchesPerLead)} disparos por lead
            </span>
          </div>

          <ol className="flex flex-col gap-3">
            {data.funnel.map((item, index) => (
              <li key={item.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium text-ink">{item.label}</span>
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-sm font-semibold tabular-nums text-ink">{item.value}</span>
                    {index > 0 && (
                      <span className="tabular-nums text-ink-subtle">
                        {formatPercent(item.conversionFromPrevious)} da etapa anterior
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                  role="img"
                  aria-label={`${item.label}: ${item.value} leads`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quart)]"
                    style={{
                      width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid content-start gap-4">
          <StatBlock
            label="Agendaram reunião"
            value={data.meetingLeads}
            detail="Inclui reunião, follow-up, sem interesse e venda"
            accent="var(--stage-follow-up)"
          />
          <StatBlock
            label="Viraram cliente"
            value={data.clientLeads}
            detail="Clientes atribuídos a disparos"
            accent="var(--stage-cliente)"
          />
          <div
            className="rounded-[var(--radius-card)] p-4 text-white elev-md"
            style={{ background: 'linear-gradient(150deg, var(--nav-from) 0%, var(--brand) 100%)' }}
          >
            <p className="flex items-center gap-2 text-xs font-medium text-white/70">
              <Users size={ICON.xs} />
              Resumo operacional
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/50">Resposta</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                  <MessageCircleReply size={ICON.xs} className="text-[var(--accent-warm)]" />
                  {formatPercent(data.responseRate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50">Avanço</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                  <TrendingUp size={ICON.xs} className="text-[var(--accent-warm)]" />
                  {formatPercent(data.advanceRate)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
