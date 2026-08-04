import type { Variants, Transition } from 'framer-motion'

/**
 * Motion do sistema.
 *
 * Regras que valem para tudo aqui:
 *  · Curvas exponenciais de saída. Sem bounce, sem elastic.
 *  · 120–260ms. O usuário está numa tarefa, não assistindo a uma coreografia.
 *  · Motion comunica estado — mudança, feedback, carregamento, entrada de
 *    conteúdo novo. Nunca decoração.
 *  · Só transform e opacity. Animar largura ou altura força layout a cada frame.
 *
 * `prefers-reduced-motion` é tratado globalmente em `globals.css`, que zera a
 * duração de toda transição e animação CSS. Para Framer Motion, use o hook
 * `useReducedMotion()` nos componentes que fazem movimento significativo.
 */

/** Curva padrão de saída — ease-out-quart. */
export const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]
/** Saída mais acentuada, para entradas de overlay. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]
/** Entrada e saída simétricas, para elementos que se movem em ambas direções. */
export const EASE_IN_OUT: [number, number, number, number] = [0.76, 0, 0.24, 1]

export const DURATION = {
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
} as const

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export const pageTransitionProps = {
  variants: pageTransition,
  initial: 'initial' as const,
  animate: 'animate' as const,
  exit: 'exit' as const,
  transition: { duration: DURATION.slow, ease: EASE_OUT } as Transition,
}

export const modalAnimation: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 2 },
}

export const modalAnimationProps = {
  variants: modalAnimation,
  initial: 'initial' as const,
  animate: 'animate' as const,
  exit: 'exit' as const,
  transition: { duration: DURATION.base, ease: EASE_OUT_EXPO } as Transition,
}

export const dragAnimation = {
  whileDrag: { scale: 1.02 },
}

/**
 * Stagger de lista. Legítimo dentro de uma lista; o que é reflexo preguiçoso
 * é aplicar a mesma entrada idêntica a toda seção da página.
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.035 } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: 4, transition: { duration: DURATION.fast, ease: EASE_OUT } },
}

export const cardHover = {
  whileHover: { y: -2, transition: { duration: DURATION.fast, ease: EASE_OUT } },
}
