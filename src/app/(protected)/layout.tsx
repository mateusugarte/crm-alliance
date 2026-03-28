import NavShell from '@/components/layout/nav-shell'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <NavShell />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
