import NavShell from '@/components/layout/nav-shell'
import { AnimatedLayout } from '@/components/layout/animated-layout'
import { getCurrentUserProfile } from '@/lib/auth/admin'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdm } = await getCurrentUserProfile()

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'consultor'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-sunken">
      <NavShell userInitial={initial} userName={displayName} isAdm={isAdm} />
      <main className="flex-1 overflow-auto">
        <AnimatedLayout>{children}</AnimatedLayout>
      </main>
    </div>
  )
}
