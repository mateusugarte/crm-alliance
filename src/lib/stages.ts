/**
 * Estágios do pipeline — fonte única de verdade para cor, rótulo e ícone.
 *
 * Antes, cada componente carregava seu próprio mapa de hex saturados
 * (`#FF4500`, `#228B22`, `#9B59B6`…) — nove cores do swatchbook de 2012, cada
 * uma gritando num volume diferente, replicadas em oito arquivos.
 *
 * Aqui cada estágio expõe três formas, todas vindas dos tokens de
 * `globals.css` (recalibrados em OKLCH com L e C coerentes entre si):
 *
 *   solid → preenchimento de barra, ponto indicador, ícone sobre superfície
 *   soft  → fundo de chip e badge
 *   ink   → texto sobre `soft`, garantido em ≥ 4.5:1
 *
 * Os valores são `var(--…)`, então o tema escuro troca sozinho.
 */
import type { IconComponent } from '@/lib/icons'
import {
  Ban, CalendarCheck, CheckCircle2, Crown, Flame,
  MessageCircleOff, RefreshCw, Snowflake, Zap,
} from '@/lib/icons'

export type StageKey =
  | 'nao_respondeu'
  | 'lead_frio'
  | 'lead_morno'
  | 'lead_quente'
  | 'follow_up'
  | 'sem_interesse'
  | 'reuniao_agendada'
  | 'visita_confirmada'
  | 'cliente'

export interface StageTokens {
  /** Preenchimento sólido: barras, pontos, ícones. */
  solid: string
  /** Fundo suave: chips, badges, faixas. */
  soft: string
  /** Texto sobre `soft` — contraste ≥ 4.5:1. */
  ink: string
}

export interface StageConfig extends StageTokens {
  key: StageKey
  label: string
  /** Rótulo curto para colunas e chips estreitos. */
  shortLabel: string
  icon: IconComponent
}

const token = (name: string): StageTokens => ({
  solid: `var(--stage-${name})`,
  soft: `var(--stage-${name}-soft)`,
  ink: `var(--stage-${name}-ink)`,
})

export const STAGES: Record<StageKey, StageConfig> = {
  nao_respondeu: {
    key: 'nao_respondeu',
    label: 'Não respondeu',
    shortLabel: 'Sem resposta',
    icon: MessageCircleOff,
    ...token('nao-respondeu'),
  },
  lead_frio: {
    key: 'lead_frio',
    label: 'Lead frio',
    shortLabel: 'Frio',
    icon: Snowflake,
    ...token('frio'),
  },
  lead_morno: {
    key: 'lead_morno',
    label: 'Lead morno',
    shortLabel: 'Morno',
    icon: Flame,
    ...token('morno'),
  },
  lead_quente: {
    key: 'lead_quente',
    label: 'Lead quente',
    shortLabel: 'Quente',
    icon: Zap,
    ...token('quente'),
  },
  reuniao_agendada: {
    key: 'reuniao_agendada',
    label: 'Reunião agendada',
    shortLabel: 'Reunião',
    icon: CalendarCheck,
    ...token('reuniao'),
  },
  follow_up: {
    key: 'follow_up',
    label: 'Follow-up',
    shortLabel: 'Follow-up',
    icon: RefreshCw,
    ...token('follow-up'),
  },
  sem_interesse: {
    key: 'sem_interesse',
    label: 'Sem interesse',
    shortLabel: 'Sem interesse',
    icon: Ban,
    ...token('sem-interesse'),
  },
  visita_confirmada: {
    key: 'visita_confirmada',
    label: 'Venda confirmada',
    shortLabel: 'Venda',
    icon: CheckCircle2,
    ...token('visita'),
  },
  cliente: {
    key: 'cliente',
    label: 'Cliente',
    shortLabel: 'Cliente',
    icon: Crown,
    ...token('cliente'),
  },
}

/** Ordem canônica do funil — do primeiro contato ao fechamento. */
export const STAGE_ORDER: StageKey[] = [
  'nao_respondeu',
  'lead_frio',
  'lead_morno',
  'lead_quente',
  'reuniao_agendada',
  'follow_up',
  'sem_interesse',
  'visita_confirmada',
  'cliente',
]

const FALLBACK: StageTokens = {
  solid: 'var(--ink-subtle)',
  soft: 'var(--surface-sunken)',
  ink: 'var(--ink-muted)',
}

/** Tokens de um estágio, com fallback neutro para chaves desconhecidas. */
export function stageTokens(key: string | null | undefined): StageTokens {
  if (!key) return FALLBACK
  return STAGES[key as StageKey] ?? FALLBACK
}

/** Configuração completa de um estágio, ou `null` se a chave não existir. */
export function stageConfig(key: string | null | undefined): StageConfig | null {
  if (!key) return null
  return STAGES[key as StageKey] ?? null
}

/** Rótulo legível de um estágio, com fallback para a própria chave. */
export function stageLabel(key: string | null | undefined): string {
  return stageConfig(key)?.label ?? key ?? '—'
}

/**
 * Faixas de score do lead. Mesma lógica de três formas dos estágios,
 * para que o chip de score fale a mesma língua visual do resto.
 */
export type ScoreBand = 'prioridade' | 'quente' | 'morno' | 'frio' | 'neutro'

export function scoreBandTokens(band: string | null | undefined): StageTokens {
  switch (band) {
    case 'prioridade':
      return { solid: 'var(--brand)', soft: 'var(--brand-soft)', ink: 'var(--brand-ink)' }
    case 'quente':
      return stageTokens('lead_quente')
    case 'morno':
      return stageTokens('lead_morno')
    case 'frio':
      return stageTokens('lead_frio')
    default:
      return FALLBACK
  }
}
