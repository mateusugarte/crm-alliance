'use client'

import { AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

/**
 * Wrapper client que habilita AnimatePresence no layout protegido.
 *
 * O layout protegido é um Server Component — não pode importar AnimatePresence
 * diretamente. Este componente resolve isso: envolve {children} com
 * AnimatePresence mode="wait" e usa pathname como key para que o React
 * identifique a troca de página e execute exit animations.
 *
 * PageTransition em cada page.tsx define initial/animate/exit via variants.
 */
export function AnimatePresenceWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      {/* key={pathname} força remontagem ao navegar, disparando exit + enter */}
      <div key={pathname} className="contents">
        {children}
      </div>
    </AnimatePresence>
  )
}
