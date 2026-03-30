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
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-alliance-blue rounded-r-full"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom — status online */}
      <div className="px-4 pb-5 pt-3 border-t border-white/10 mt-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-alliance-blue/20 text-alliance-blue flex items-center justify-center text-xs font-bold">
              A
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border-2 border-alliance-dark" />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="text-white/80 text-xs font-semibold truncate leading-tight">Consultor</span>
            <span className="text-white/30 text-[10px] leading-tight">Online</span>
          </div>
        </div>
      </div>
    </motion.aside>
  )
}
