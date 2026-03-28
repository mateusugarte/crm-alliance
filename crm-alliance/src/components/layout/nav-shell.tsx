'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LayoutDashboard, Kanban, Calendar, Building2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Pipeline', icon: Kanban },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/interacoes', label: 'Interações', icon: MessageSquare },
]

export default function NavShell() {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-56 flex-shrink-0 bg-alliance-dark flex flex-col h-full"
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <span className="font-bold text-white text-xl tracking-tight leading-none block">
          Alliance
        </span>
        <span className="text-white/40 text-xs font-medium tracking-widest uppercase mt-0.5 block">
          La Reserva
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mb-3" />

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/8'
              )}
            >
              <Icon
                size={17}
                className={isActive ? 'text-alliance-blue' : 'text-current'}
              />
              {label}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 w-0.5 h-5 bg-alliance-blue rounded-r-full"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 pb-6 pt-3 border-t border-white/10 mt-3">
        <p className="text-white/25 text-xs">CRM v1.0</p>
      </div>
    </motion.aside>
  )
}
