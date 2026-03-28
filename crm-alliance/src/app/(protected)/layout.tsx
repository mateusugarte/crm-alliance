import NavShell from '@/components/layout/nav-shell'
import { AnimatePresenceWrapper } from '@/components/layout/animate-presence-wrapper'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    // Usa token semântico var(--background) em vez de bg-gray-50 hardcoded
    <div className="flex h-screen overflow-hidden bg-background">
      <NavShell />
      <main className="flex-1 overflow-auto">
        {/* AnimatePresenceWrapper habilita exit animations do PageTransition */}
        <AnimatePresenceWrapper>
          {children}
        </AnimatePresenceWrapper>
      </main>
    </div>
  )
}
