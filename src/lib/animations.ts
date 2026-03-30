import type { Variants, Transition } from 'framer-motion'

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const pageTransitionProps = {
  variants: pageTransition,
  initial: 'initial' as const,
  animate: 'animate' as const,
  exit: 'exit' as const,
  transition: { duration: 0.25, ease: 'easeOut' } as Transition,
}

export const modalAnimation: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export const modalAnimationProps = {
  variants: modalAnimation,
  initial: 'initial' as const,
  animate: 'animate' as const,
  exit: 'exit' as const,
  transition: { duration: 0.2, ease: 'easeOut' } as Transition,
}

export const dragAnimation = {
  whileDrag: { scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, y: 6, transition: { duration: 0.15, ease: 'easeIn' } },
}

export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.15 } },
}
