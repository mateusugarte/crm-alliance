'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

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
      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer"
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
