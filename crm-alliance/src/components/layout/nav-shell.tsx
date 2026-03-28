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
  // Wave H — badge numérico no ícone do Kanban quando lead muda de stage via Realtime
  const [kanbanBadge, setKanbanBadge] = useState(0)
  // Wave H — pulsing dot na nav de Interacoes quando nova mensagem inbound chega
  const [interacoesDot, setInteracoesDot] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Canal para badge do Kanban (mudancas de stage)
    const kanbanChannel = supabase
      .channel('nav-leads-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updated = payload.new as Lead
          const old = payload.old as Partial<Lead>
          // Apenas mudanca de stage conta para o badge
          if (old.stage && updated.stage && old.stage !== updated.stage) {
            // So incrementa se nao estiver na pagina do kanban
            if (!window.location.pathname.startsWith('/kanban')) {
              setKanbanBadge(n => n + 1)
            }
          }
        }
      )
      .subscribe()

    // Canal para dot de Interacoes (mensagens inbound)
    const interacoesChannel = supabase
      .channel('nav-interactions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interactions' },
        (payload) => {
          const msg = payload.new as { direction: string }
          if (msg.direction === 'inbound') {
            // So acende se nao estiver na pagina de interacoes
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

  // Limpar badge ao entrar na pagina correspondente
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
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          const isKanban = href === '/kanban'
          const isInteracoes = href === '/interacoes'

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
              {/* Icone com badge numérico para Kanban */}
              <span className="relative flex-shrink-0">
                <Icon
                  size={17}
                  className={isActive ? 'text-alliance-blue' : 'text-current'}
                />
                {/* Wave H — badge numérico no Kanban */}
                {isKanban && kanbanBadge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-alliance-blue text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {kanbanBadge > 9 ? '9+' : kanbanBadge}
                  </span>
                )}
                {/* Wave H — pulsing dot na nav de Interacoes */}
                {isInteracoes && interacoesDot && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-alliance-blue rounded-full animate-pulse" />
                )}
              </span>

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
