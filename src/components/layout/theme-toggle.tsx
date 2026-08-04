'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, ICON } from '@/lib/icons'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const html = document.documentElement
    if (html.classList.contains('dark')) {
      html.classList.remove('dark')
      localStorage.setItem('crm-theme', 'light')
      setDark(false)
    } else {
      html.classList.add('dark')
      localStorage.setItem('crm-theme', 'dark')
      setDark(true)
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      aria-label={dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-ui hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {dark ? <Sun size={ICON.sm} /> : <Moon size={ICON.sm} />}
    </button>
  )
}
