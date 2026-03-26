import type { Variants } from 'framer-motion'

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const pageTransitionProps = {
  variants: pageTransition,
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  transition: { duration: 0.25, ease: 'easeOut' },
}

export const modalAnimation: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export const modalAnimationProps = {
  variants: modalAnimation,
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  transition: { duration: 0.2, ease: 'easeOut' },
}

export const dragAnimation = {
  whileDrag: { scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
}

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.15 } },
}
