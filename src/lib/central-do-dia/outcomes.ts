import {
  Ban, Check, Clock, PhoneCall, RefreshCw, X, type IconComponent,
} from '@/lib/icons'
import type { StageTokens } from '@/lib/stages'
import type { TaskOutcome } from './types'

/**
 * Vocabulário de desfecho de ligação.
 *
 * Fonte única para a fila do dashboard e para o histórico no painel do lead —
 * antes o rótulo ("Atendeu", "Caixa postal") existia só dentro do componente
 * da fila, então o painel do lead não tinha como falar a mesma língua.
 *
 * `tone` é o par soft/ink do design system, então o chip do desfecho troca de
 * tema junto com o resto e mantém contraste ≥ 4.5:1 nos dois.
 */
export interface OutcomeConfig {
  value: TaskOutcome
  label: string
  /** Frase curta no passado, para a linha do histórico. */
  pastLabel: string
  icon: IconComponent
  tone: StageTokens
  /** Contou como conversa real com o lead. */
  isContact: boolean
}

const tone = (name: string): StageTokens => ({
  solid: `var(--${name})`,
  soft: `var(--${name}-soft)`,
  ink: `var(--${name}-ink)`,
})

export const OUTCOMES: OutcomeConfig[] = [
  {
    value: 'atendeu',
    label: 'Atendeu',
    pastLabel: 'Atendeu',
    icon: Check,
    tone: tone('success'),
    isContact: true,
  },
  {
    value: 'pediu_retorno',
    label: 'Pediu retorno',
    pastLabel: 'Pediu retorno',
    icon: Clock,
    tone: tone('stage-frio'),
    isContact: true,
  },
  {
    value: 'nao_atendeu',
    label: 'Não atendeu',
    pastLabel: 'Não atendeu',
    icon: PhoneCall,
    tone: tone('stage-nao-respondeu'),
    isContact: false,
  },
  {
    value: 'caixa_postal',
    label: 'Caixa postal',
    pastLabel: 'Caiu na caixa postal',
    icon: RefreshCw,
    tone: tone('stage-nao-respondeu'),
    isContact: false,
  },
  {
    value: 'numero_errado',
    label: 'Número errado',
    pastLabel: 'Número para corrigir',
    icon: X,
    tone: tone('warning'),
    isContact: false,
  },
  {
    value: 'sem_interesse',
    label: 'Sem interesse',
    pastLabel: 'Sem interesse agora',
    icon: Ban,
    tone: tone('danger'),
    isContact: true,
  },
]

const BY_VALUE = new Map(OUTCOMES.map(item => [item.value, item]))

export function outcomeConfig(value: TaskOutcome): OutcomeConfig {
  return BY_VALUE.get(value) ?? OUTCOMES[2]!
}

/** Contexto registrado antes de o lead voltar para a base fria. */
export const LOSS_REASONS = [
  'Preço ou condição',
  'Momento de compra',
  'Localização ou produto',
  'Comprou outro imóvel',
  'Não quer continuar o contato',
  'Outro',
]
