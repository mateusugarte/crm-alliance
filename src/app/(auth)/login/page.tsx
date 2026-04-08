'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { signIn } from './actions'

const LOGO_URL = 'https://lmvdruvmpybutmmidrfp.supabase.co/storage/v1/object/public/la%20reserva/Branco.png'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-full overflow-hidden bg-black">

      {/* Grid de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Glow central azul */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(30,144,255,0.10) 0%, transparent 75%)',
        }}
      />

      {/* Linhas de brilho nas bordas */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-alliance-blue/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-alliance-blue/20 to-transparent pointer-events-none" />

      {/* Logo + nome */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="z-10 flex flex-col items-center mb-10"
      >
        <div
          className="mb-5 relative"
          style={{ filter: 'drop-shadow(0 0 24px rgba(30,144,255,0.35))' }}
        >
          <Image
            src={LOGO_URL}
            alt="Alliance"
            width={150}
            height={75}
            className="object-contain"
            priority
          />
        </div>
        <motion.h1
          initial={{ opacity: 0, letterSpacing: '0.5em' }}
          animate={{ opacity: 1, letterSpacing: '0.18em' }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="text-white font-bold text-xl uppercase"
        >
          Alliance System
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-white/25 text-[9px] tracking-[0.35em] uppercase mt-1.5"
        >
          Plataforma de Gestão
        </motion.p>
      </motion.div>

      {/* Card de login */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="z-10 w-full max-w-sm mx-4"
      >
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl px-8 py-8 flex flex-col gap-5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 80px rgba(30,144,255,0.07), 0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Campo email */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="flex flex-col gap-1.5"
          >
            <label className="text-[9px] font-bold text-white/35 uppercase tracking-[0.25em]">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="seu@email.com"
              className="rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={e => {
                e.currentTarget.style.border = '1px solid rgba(30,144,255,0.5)'
                e.currentTarget.style.background = 'rgba(30,144,255,0.06)'
              }}
              onBlur={e => {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
            />
          </motion.div>

          {/* Campo senha */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }}
            className="flex flex-col gap-1.5"
          >
            <label className="text-[9px] font-bold text-white/35 uppercase tracking-[0.25em]">
              Senha
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={e => {
                e.currentTarget.style.border = '1px solid rgba(30,144,255,0.5)'
                e.currentTarget.style.background = 'rgba(30,144,255,0.06)'
              }}
              onBlur={e => {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
            />
          </motion.div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400/90 text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          {/* Botão */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-full py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)',
              boxShadow: '0 0 32px rgba(30,144,255,0.25)',
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </>
            ) : 'Entrar'}
          </motion.button>
        </form>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-7 text-white/12 text-[9px] tracking-[0.25em] uppercase z-10"
      >
        Alliance Investimentos © 2025
      </motion.p>
    </div>
  )
}
