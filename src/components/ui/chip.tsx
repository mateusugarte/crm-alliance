/**
 * Chips e indicadores de estágio.
 *
 * Substitui duas coisas que o projeto fazia de forma errada e repetida:
 *
 *  1. A faixa lateral colorida (`border-l-4`, barra de 2px no topo, filete de
 *     0.5px) usada como indicador de estágio. É decoração sem função — o
 *     usuário não consegue ler "laranja de 4px" como "lead morno". Um ponto
 *     com rótulo comunica a mesma coisa e é legível.
 *
 *  2. O eyebrow minúsculo (`text-[9px] uppercase tracking-widest` cinza claro)
 *     em cima de todo card. Além de ser ruído repetido, 9px cinza sobre branco
 *     não passa em contraste. Aqui o piso é 11px com cor `ink-muted`.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ICON, type IconComponent } from '@/lib/icons'
import type { StageTokens } from '@/lib/stages'

/* -------------------------------------------------------------------------
   Ponto de estágio — o indicador que substitui a faixa lateral
   ---------------------------------------------------------------------- */

export function StageDot({
  tokens,
  size = 8,
  className,
}: {
  tokens: StageTokens
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block flex-shrink-0 rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: tokens.solid }}
    />
  )
}

/* -------------------------------------------------------------------------
   Chip — badge de fundo suave com texto legível
   ---------------------------------------------------------------------- */

const CHIP_SIZE = {
  sm: 'h-5 px-1.5 gap-1 text-2xs',
  md: 'h-6 px-2 gap-1.5 text-xs',
} as const

export interface ChipProps {
  children: ReactNode
  /** Tokens do estágio ou da faixa de score. Omitido = chip neutro. */
  tokens?: StageTokens
  icon?: IconComponent
  size?: keyof typeof CHIP_SIZE
  /** Preenchimento sólido em vez de suave. Use com parcimônia. */
  solid?: boolean
  className?: string
  title?: string
}

export function Chip({
  children,
  tokens,
  icon: Icon,
  size = 'sm',
  solid = false,
  className,
  title,
}: ChipProps) {
  const style = tokens
    ? solid
      ? { backgroundColor: tokens.solid, color: 'white' }
      : { backgroundColor: tokens.soft, color: tokens.ink }
    : undefined

  return (
    <span
      title={title}
      style={style}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md font-medium leading-none',
        CHIP_SIZE[size],
        !tokens && 'bg-surface-sunken text-ink-muted',
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : ICON.xs} />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------
   Badge de estágio — ponto + rótulo, o par completo
   ---------------------------------------------------------------------- */

export function StageBadge({
  tokens,
  label,
  className,
}: {
  tokens: StageTokens
  label: string
  className?: string
}) {
  return (
    <span
      style={{ backgroundColor: tokens.soft, color: tokens.ink }}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none',
        className,
      )}
    >
      <StageDot tokens={tokens} size={6} />
      {label}
    </span>
  )
}

/* -------------------------------------------------------------------------
   Rótulo de seção — substitui o eyebrow de 9px
   ---------------------------------------------------------------------- */

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('block text-xs font-medium text-ink-muted', className)}>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------
   Contador em pílula — usado em cabeçalhos de coluna e abas
   ---------------------------------------------------------------------- */

export function CountPill({
  value,
  tokens,
  className,
}: {
  value: number
  tokens?: StageTokens
  className?: string
}) {
  return (
    <span
      style={tokens ? { backgroundColor: tokens.soft, color: tokens.ink } : undefined}
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold tabular-nums leading-none',
        !tokens && 'bg-surface-sunken text-ink-muted',
        className,
      )}
    >
      {value}
    </span>
  )
}
