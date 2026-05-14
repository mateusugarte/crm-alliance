'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  LayoutDashboard, Kanban, Calendar, Building2, MessageSquare,
  Settings, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Send, Smartphone, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'
import { useEffect, useState } from 'react'

const LOGO_URL = 'https://lmvdruvmpybutmmidrfp.supabase.co/storage/v1/object/public/la%20reserva/Branco.png'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Pipeline', icon: Kanban },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/interacoes', label: 'Interações', icon: MessageSquare },
]

const DISPARO_ITEMS = [
  { href: '/reativar', label: 'Reativar', icon: RefreshCw },
  { href: '/disparos', label: 'Disparos', icon: Send },
  { href: '/instancias', label: 'Instâncias', icon: Smartphone },
  { href: '/templates', label: 'Templates', icon: FileText },
]

interface NavShellProps {
  userInitial?: string
  userName?: string
}

export default function NavShell({ userInitial = 'C', userName = 'consultor' }: NavShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
    } catch { /* ignore */ }
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch { /* ignore */ }
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #071f7a 0%, #0A2EAD 45%, #0d35c4 100%)' }}
    >
      {/* Logo */}
      <div className="px-3 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Ícone colapsado: logo */}
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
            <Image
              src={LOGO_URL}
              alt="Alliance"
              width={36}
              height={36}
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}
            />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.14 }}
                className="overflow-hidden"
              >
                <span className="font-bold text-white text-[15px] tracking-tight leading-none block whitespace-nowrap">
                  Alliance
                </span>
                <span className="text-white/40 text-[9px] font-medium tracking-[0.2em] uppercase mt-0.5 block whitespace-nowrap">
                  System
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/10 mb-2 flex-shrink-0" />

      {/* Nav principal */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-1 overflow-hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150 overflow-hidden',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive ? 'text-white' : 'text-white/50 hover:text-white/85',
              )}
            >
              {/* Active background pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0 rounded-xl bg-white/15"
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                />
              )}
              {/* Hover background */}
              <span className={cn(
                'absolute inset-0 rounded-xl transition-colors duration-150',
                !isActive && 'hover:bg-white/8',
              )} />

              <Icon
                size={16}
                className="flex-shrink-0 relative z-10"
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.14 }}
                    className={cn('whitespace-nowrap overflow-hidden relative z-10', isActive && 'font-semibold')}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Divider disparos */}
      <div className="mx-3 border-t border-white/10 mt-1 mb-1 flex-shrink-0" />

      {/* Seção Disparos */}
      <div className="px-2 pb-1 flex-shrink-0">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="px-3 pt-1.5 pb-1 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] whitespace-nowrap"
            >
              Disparos
            </motion.p>
          )}
        </AnimatePresence>
        <div className="flex flex-col gap-0.5">
          {DISPARO_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150 overflow-hidden',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive ? 'text-white' : 'text-white/50 hover:text-white/85',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-xl bg-white/15"
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
                <span className={cn(
                  'absolute inset-0 rounded-xl transition-colors duration-150',
                  !isActive && 'hover:bg-white/8',
                )} />
                <Icon
                  size={16}
                  className="flex-shrink-0 relative z-10"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.14 }}
                      className={cn('whitespace-nowrap overflow-hidden relative z-10', isActive && 'font-semibold')}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Divider sistema */}
      <div className="mx-3 border-t border-white/10 mt-1 mb-1 flex-shrink-0" />

      {/* Seção Sistema */}
      <div className="px-2 pb-1 flex-shrink-0">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="px-3 pt-1.5 pb-1 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] whitespace-nowrap"
            >
              Sistema
            </motion.p>
          )}
        </AnimatePresence>
        <span
          title={collapsed ? 'Configurações' : undefined}
          className={cn(
            'flex items-center rounded-xl text-sm font-medium text-white/25 cursor-not-allowed',
            collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2',
          )}
        >
          <Settings size={15} strokeWidth={1.8} className="flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.14 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Configurações
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      {/* Divider footer */}
      <div className="mx-3 border-t border-white/10 flex-shrink-0" />

      {/* Footer: usuário + tema + colapsar */}
      <div className={cn(
        'px-3 pb-4 pt-3 flex-shrink-0',
        collapsed ? 'flex flex-col items-center gap-2.5' : 'flex flex-col gap-2',
      )}>
        {/* Usuário */}
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-[11px] font-bold border border-white/25">
              {userInitial}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2"
              style={{ borderColor: '#0A2EAD' }}
            />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.14 }}
                className="min-w-0 overflow-hidden"
              >
                <span className="text-white/80 text-xs font-semibold truncate leading-tight capitalize block whitespace-nowrap">
                  {userName}
                </span>
                <span className="text-white/35 text-[10px] leading-tight block">Online</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controles */}
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <ThemeToggle />
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer"
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
