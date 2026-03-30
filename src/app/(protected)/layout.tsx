import { createClient } from '@/lib/supabase/server'
import NavShell from '@/components/layout/nav-shell'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const displayName = user?.email?.split('@')[0] ?? 'consultor'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <NavShell userInitial={initial} userName={displayName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
