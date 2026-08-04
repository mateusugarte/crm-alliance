'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Building2, Calendar, Kanban, LayoutDashboard, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Send, Settings, ICON, type IconComponent,
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT } from '@/lib/animations'
import { ThemeToggle } from './theme-toggle'

const LOGO_URL = 'https://lmvdruvmpybutmmidrfp.supabase.co/storage/v1/object/public/la%20reserva/Branco.png'

interface NavEntry {
  href: string
  label: string
  icon: IconComponent
}

const NAV_ITEMS: NavEntry[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Pipeline', icon: Kanban },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/interacoes', label: 'Interações', icon: MessageSquare },
]

const DISPARO_ITEMS: NavEntry[] = [
  { href: '/disparos', label: 'Disparos', icon: Send },
]

const SYSTEM_ITEMS: NavEntry[] = [
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

interface NavShellProps {
  userInitial?: string
  userName?: string
  isAdm?: boolean
}

/**
 * Item de navegação.
 *
 * Estava triplicado neste arquivo — uma cópia para o nav principal, outra para
 * disparos, outra para configurações — com divergências de padding entre elas.
 * Agora é um componente só.
 */
function NavItem({
  entry,
  collapsed,
  active,
}: {
  entry: NavEntry
  collapsed: boolean
  active: boolean
}) {
  const Icon = entry.icon

  return (
    <Link
      href={entry.href}
      title={collapsed ? entry.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center overflow-hidden rounded-lg text-sm transition-ui',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
        active ? 'font-medium text-white' : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-white/[0.13]"
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
        />
      )}
      <Icon size={ICON.md} weight={active ? 'fill' : 'regular'} className="relative z-10 flex-shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            className="relative z-10 overflow-hidden whitespace-nowrap"
          >
            {entry.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}

function SectionHeading({ children, collapsed }: { children: string; collapsed: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast }}
          className="whitespace-nowrap px-3 pb-1 pt-2 text-xs font-medium text-white/35"
        >
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export default function NavShell({ userInitial = 'C', userName = 'consultor', isAdm = false }: NavShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
    } catch { /* ignore */ }

    const media = window.matchMedia('(max-width: 767px)')
    const syncViewport = () => setCompactViewport(media.matches)
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch { /* ignore */ }
  }

  const isActive = (href: string) => pathname.startsWith(href)
  const navigationCollapsed = collapsed || compactViewport

  return (
    <motion.aside
      animate={{ width: navigationCollapsed ? 68 : 228 }}
      initial={false}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="flex h-full flex-shrink-0 flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--nav-from) 0%, var(--nav-to) 100%)' }}
    >
      {/* Marca */}
      <div className="flex-shrink-0 px-3 pb-4 pt-5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
            <Image src={LOGO_URL} alt="Alliance" width={36} height={36} className="object-contain" />
          </div>
          <AnimatePresence initial={false}>
            {!navigationCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: DURATION.fast }}
                className="overflow-hidden"
              >
                <span className="block whitespace-nowrap text-md font-semibold leading-none tracking-tight text-white">
                  Alliance
                </span>
                <span className="mt-1 block whitespace-nowrap text-2xs font-medium leading-none text-white/45">
                  La Reserva
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mx-3 mb-2 flex-shrink-0 border-t border-white/[0.08]" />

      {/* Navegação principal */}
      <nav className="flex flex-1 flex-col gap-1 overflow-hidden px-2.5">
        {NAV_ITEMS.map(entry => (
          <NavItem key={entry.href} entry={entry} collapsed={navigationCollapsed} active={isActive(entry.href)} />
        ))}
      </nav>

      {/* Disparos */}
      <div className="flex-shrink-0 px-2.5 pb-1">
        <SectionHeading collapsed={navigationCollapsed}>Disparos</SectionHeading>
        <div className="flex flex-col gap-1">
          {DISPARO_ITEMS.map(entry => (
            <NavItem key={entry.href} entry={entry} collapsed={navigationCollapsed} active={isActive(entry.href)} />
          ))}
        </div>
      </div>

      {/* Sistema */}
      {isAdm && (
        <div className="flex-shrink-0 px-2.5 pb-2">
          <SectionHeading collapsed={navigationCollapsed}>Sistema</SectionHeading>
          <div className="flex flex-col gap-1">
            {SYSTEM_ITEMS.map(entry => (
              <NavItem key={entry.href} entry={entry} collapsed={navigationCollapsed} active={isActive(entry.href)} />
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 flex-shrink-0 border-t border-white/[0.08]" />

      {/* Usuário e controles */}
      <div
        className={cn(
          'flex flex-shrink-0 flex-col px-3 pb-4 pt-3',
          navigationCollapsed ? 'items-center gap-2.5' : 'gap-2.5',
        )}
      >
        <div className={cn('flex items-center', navigationCollapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="relative flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {userInitial}
            </div>
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 bg-[var(--accent-warm)]"
              style={{ borderColor: 'var(--nav-to)' }}
            />
          </div>
          <AnimatePresence initial={false}>
            {!navigationCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
                className="min-w-0 overflow-hidden"
              >
                <span className="block truncate whitespace-nowrap text-sm font-medium capitalize leading-tight text-white">
                  {userName}
                </span>
                <span className="block text-xs leading-tight text-white/45">Online</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={cn('flex items-center gap-1', navigationCollapsed && 'flex-col')}>
          <ThemeToggle />
          <button
            onClick={toggleCollapse}
            title={navigationCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={navigationCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-ui hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              compactViewport ? 'hidden' : 'flex',
            )}
          >
            {navigationCollapsed ? <PanelLeftOpen size={ICON.sm} /> : <PanelLeftClose size={ICON.sm} />}
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
