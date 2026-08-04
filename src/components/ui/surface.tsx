/**
 * Superfície — o container padrão do sistema.
 *
 * Substitui as ~12 combinações de `rounded-xl border border-gray-100 bg-surface
 * elev-sm dark:…` copiadas manualmente pelo projeto, cada uma com um raio e
 * uma sombra ligeiramente diferentes.
 *
 * Três variantes, correspondendo aos três planos de profundidade:
 *   inset  → afundado. Colunas do Kanban, áreas de leitura, campos.
 *   flat   → no plano. Cards de conteúdo dentro de um painel já elevado.
 *   raised → elevado. Cards de primeiro nível sobre o fundo da página.
 *
 * Cards aninhados são sempre erro: se você precisa de um card dentro de um
 * card, o de dentro é `inset` ou não é card nenhum.
 */
import type { ElementType, ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  inset: 'bg-surface-sunken border border-transparent',
  flat: 'bg-surface border border-line',
  raised: 'bg-surface-raised border border-line elev-sm',
} as const

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const

const RADIUS = {
  md: 'rounded-lg',
  card: 'rounded-[var(--radius-card)]',
  panel: 'rounded-[var(--radius-panel)]',
} as const

export interface SurfaceProps<T extends ElementType = 'div'> {
  as?: T
  variant?: keyof typeof VARIANTS
  padding?: keyof typeof PADDING
  radius?: keyof typeof RADIUS
  /** Eleva no hover. Só para superfícies clicáveis. */
  interactive?: boolean
  className?: string
}

export function Surface<T extends ElementType = 'div'>({
  as,
  variant = 'raised',
  padding = 'md',
  radius = 'card',
  interactive = false,
  className,
  ...rest
}: SurfaceProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof SurfaceProps<T>>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      className={cn(
        RADIUS[radius],
        VARIANTS[variant],
        PADDING[padding],
        interactive && 'transition-ui hover:elev-md hover:border-line-strong cursor-pointer',
        className,
      )}
      {...rest}
    />
  )
}
