'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LayoutDashboard, Kanban, Calendar, Building2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Kanban', icon: Kanban },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/interacoes', label: 'Interações', icon: MessageSquare },
]

export default function NavShell() {
  const pathname = usePathname()

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-center gap-1 px-4 py-3 bg-white border-b border-gray-100 shadow-sm"
    >
      <span className="font-bold text-alliance-dark text-lg mr-6">Alliance</span>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              isActive
                ? 'bg-alliance-dark text-white'
                : 'text-gray-600 hover:text-alliance-dark'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        )
      })}
    </motion.nav>
  )
}
