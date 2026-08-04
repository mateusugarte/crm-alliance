import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar, Clock, DollarSign, PhoneCall,
  PauseCircle, Smartphone, AlertTriangle, ICON,
} from '@/lib/icons'
import type { BusinessOperationsData } from '@/app/(protected)/dashboard/page'

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

function hours(value: number | null) {
  if (value == null) return 'Sem dados'
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

export function BusinessOperationsSection({ data }: { data: BusinessOperationsData }) {
  const sellThrough = data.unitsTotal ? (data.totalUnitsSold / data.unitsTotal) * 100 : 0

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-line bg-surface elev-sm">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-2xs font-semibold uppercase text-ink-subtle">Negócio</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">Resultado comercial</h2>
          </div>
          <div className="flex items-center gap-2 text-ink-subtle">
            {data.commercialBaselineDate && <span className="hidden text-2xs sm:inline">Base atualizada em {data.commercialBaselineDate}</span>}
            <DollarSign size={ICON.lg} className="text-brand" />
          </div>
        </header>
        <div className="grid md:grid-cols-3">
          <BusinessMetric
            label="Resultado pós CRM"
            value={`${data.postCrmUnitsSold} ${data.postCrmUnitsSold === 1 ? 'unidade' : 'unidades'}`}
            detail={`${currency(data.postCrmVgv)} de VGV estimado`}
            note={`${data.salesFromDispatch} via disparo · vendas registradas no sistema`}
            emphasis
          />
          <BusinessMetric
            label="Resultado pré CRM"
            value={`${data.preCrmUnitsSold} ${data.preCrmUnitsSold === 1 ? 'unidade' : 'unidades'}`}
            detail={`${currency(data.preCrmVgv)} de VGV estimado`}
            note="Estimativa pela tabela geral de vendas"
          />
          <BusinessMetric
            label="Total vendido"
            value={`${data.totalUnitsSold} de ${data.unitsTotal}`}
            detail={`${currency(data.totalSoldVgv)} de VGV estimado`}
            note={`${sellThrough.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do estoque`}
            last
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase text-ink-subtle">Agenda</p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">Próximos 7 dias</h2>
            </div>
            <span className="text-xs text-ink-muted">{data.meetingAttendanceRate.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% de comparecimento</span>
          </div>
          {data.nextMeetings.length ? (
            <div className="divide-y divide-line">
              {data.nextMeetings.map(meeting => (
                <div key={meeting.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{meeting.leadName}</p>
                    <p className="text-xs capitalize text-ink-muted">{format(new Date(meeting.datetime), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-brand"><Calendar size={ICON.xs} />{format(new Date(meeting.datetime), 'HH:mm')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-surface-sunken px-4 py-8 text-center text-sm text-ink-muted">Nenhuma reunião agendada para os próximos 7 dias.</p>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm">
          <p className="text-2xs font-semibold uppercase text-ink-subtle">Motivos de perda</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">O que está impedindo a venda</h2>
          {data.lossReasons.length ? (
            <div className="mt-4 divide-y divide-line">
              {data.lossReasons.map(item => (
                <div key={item.reason} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-ink-muted">{item.reason}</span>
                  <span className="font-semibold tabular-nums text-ink">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-surface-sunken px-4 py-8 text-center text-sm text-ink-muted">Os motivos passam a aparecer a partir dos próximos registros.</p>
          )}
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 elev-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-2xs font-semibold uppercase text-ink-subtle">Operação</p>
          <span className="text-2xs text-ink-subtle">Leitura da semana</span>
        </div>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
          <OperationMetric icon={<Clock size={ICON.sm} />} label="Tempo até 1ª ligação" value={`${hours(data.firstCallMedianHours)} mediana`} detail={`${hours(data.firstCallAverageHours)} média`} />
          <OperationMetric icon={<Smartphone size={ICON.sm} />} label="Esteira de resgate" value={`${data.rescueWorked} de ${data.rescueTotal}`} detail={data.rescueForecast ? `previsão ${data.rescueForecast}` : 'estoque processado'} />
          <OperationMetric icon={<PhoneCall size={ICON.sm} />} label="Ligações na semana" value={String(data.weeklyCalls)} detail={`${data.weeklyAnswered} atendidas`} />
          <OperationMetric icon={<PauseCircle size={ICON.sm} />} label="Pausas da Alice" value={String(data.weeklyPauses)} detail="registradas na semana" />
          <OperationMetric icon={<AlertTriangle size={ICON.sm} />} label="Dados a corrigir" value={String(data.wrongNumbers)} detail="números incorretos" />
        </div>
      </section>
    </div>
  )
}

function BusinessMetric({
  label,
  value,
  detail,
  note,
  last = false,
  emphasis = false,
}: {
  label: string
  value: string
  detail: string
  note: string
  last?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={`relative px-5 py-5 ${last ? '' : 'border-b border-line md:border-b-0 md:border-r'} ${emphasis ? 'bg-brand-soft/35' : ''}`}>
      {emphasis && <span className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-brand" />}
      <p className={`text-xs font-medium ${emphasis ? 'text-brand' : 'text-ink-muted'}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-sm font-medium tabular-nums text-ink">{detail}</p>
      <p className="mt-1 text-2xs text-ink-subtle">{note}</p>
    </div>
  )
}

function OperationMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-l border-line pl-3">
      <p className="flex items-center gap-1.5 truncate text-2xs text-ink-subtle">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
      <p className="truncate text-2xs text-ink-muted">{detail}</p>
    </div>
  )
}
