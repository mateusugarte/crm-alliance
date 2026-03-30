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

interface NavShellProps {
  userInitial?: string
  userName?: string
}

export default function NavShell({ userInitial = 'C', userName = 'consultor' }: NavShellProps) {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, #0A2EAD 0%, #0d35c4 100%)' }}
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center gap-2.5 mb-0.5">
          {/* Diamond mark */}
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path
                d="M12 2L22 9.5L12 22L2 9.5L12 2Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M12 2L22 9.5L12 22L2 9.5L12 2Z"
                fill="none"
                stroke="white"
                strokeOpacity="0.3"
                strokeWidth="0.5"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-white text-[17px] tracking-tight leading-none block">
              Alliance
            </span>
            <span className="text-white/40 text-[10px] font-medium tracking-[0.18em] uppercase mt-0.5 block">
              La Reserva
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mb-2" />

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-1">
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
                  : 'text-white/50 hover:text-white/80 hover:bg-white/8'
              )}
            >
              <Icon
                size={16}
                className={isActive ? 'text-white' : 'text-current'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={isActive ? 'font-semibold' : ''}>{label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mt-2" />

      {/* User */}
      <div className="px-4 pb-5 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center text-xs font-bold border border-white/20">
              {userInitial}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border-2"
              style={{ borderColor: '#0A2EAD' }}
            />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="text-white/85 text-xs font-semibold truncate leading-tight capitalize">
              {userName}
            </span>
            <span className="text-white/35 text-[10px] leading-tight">Online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
