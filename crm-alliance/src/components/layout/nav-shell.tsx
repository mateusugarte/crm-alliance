'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, Kanban, Calendar, Building2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/supabase/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Pipeline', icon: Kanban },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/interacoes', label: 'Interações', icon: MessageSquare },
]

export default function NavShell() {
  const pathname = usePathname()
  const [kanbanBadge, setKanbanBadge] = useState(0)
  const [interacoesDot, setInteracoesDot] = useState(false)
  const [userInitial, setUserInitial] = useState<string>('?')
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()

    // Buscar dados do usuário logado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const profile = data as { full_name: string } | null
          const name = profile?.full_name ?? user.email ?? ''
          setUserName(name)
          setUserInitial((name[0] ?? '?').toUpperCase())
        })
    })

    const kanbanChannel = supabase
      .channel('nav-leads-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updated = payload.new as Lead
          const old = payload.old as Partial<Lead>
          if (old.stage && updated.stage && old.stage !== updated.stage) {
            if (!window.location.pathname.startsWith('/kanban')) {
              setKanbanBadge(n => n + 1)
            }
          }
        }
      )
      .subscribe()

    const interacoesChannel = supabase
      .channel('nav-interactions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interactions' },
        (payload) => {
          const msg = payload.new as { direction: string }
          if (msg.direction === 'inbound') {
            if (!window.location.pathname.startsWith('/interacoes')) {
              setInteracoesDot(true)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(kanbanChannel)
      supabase.removeChannel(interacoesChannel)
    }
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/kanban')) setKanbanBadge(0)
    if (pathname.startsWith('/interacoes')) setInteracoesDot(false)
  }, [pathname])

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
      <nav className="flex-1 flex flex-col gap-1 px-3 relative">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          const isKanban = href === '/kanban'
          const isInteracoes = href === '/interacoes'

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white'
              )}
            >
              {/* Fundo animado do item ativo — desliza entre itens (padrão Linear) */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0 rounded-xl bg-white/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}

              {/* Indicador lateral animado */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-indicator"
                  className="absolute left-0 w-0.5 h-5 bg-alliance-blue rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}

              <span className="relative z-10 flex-shrink-0">
                <Icon
                  size={17}
                  className={isActive ? 'text-alliance-blue' : 'text-current'}
                />
                {isKanban && kanbanBadge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-alliance-blue text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {kanbanBadge > 9 ? '9+' : kanbanBadge}
                  </span>
                )}
                {isInteracoes && interacoesDot && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-alliance-blue rounded-full animate-pulse" />
                )}
              </span>

              <span className="relative z-10">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom — avatar do usuário logado */}
      <div className="px-4 pb-5 pt-3 border-t border-white/10 mt-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-alliance-blue/20 text-alliance-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
            {userInitial}
          </div>
          {userName && (
            <span className="text-white/60 text-xs font-medium truncate leading-tight">
              {userName}
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
