import NavShell from '@/components/layout/nav-shell'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <NavShell />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
