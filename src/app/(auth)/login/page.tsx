'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { DURATION, EASE_OUT } from '@/lib/animations'
import { signIn } from './actions'

const LOGO_URL = 'https://lmvdruvmpybutmmidrfp.supabase.co/storage/v1/object/public/la%20reserva/Branco.png'

/**
 * Tela de entrada.
 *
 * Antes: preto puro, grade de linhas e um glow radial azul — a estética
 * genérica de "painel de controle sci-fi", que não diz nada sobre o produto.
 * Agora a porta de entrada mostra o que a equipe vende.
 *
 * A entrada é uma transição só, curta. A sequência escalonada de cinco
 * elementos que existia aqui fazia o usuário esperar por uma coreografia
 * antes de poder digitar.
 */
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
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <Image
        src="/brand/la-reserva-golden.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Véu para legibilidade — escurece o suficiente para texto branco
          sem apagar a fachada. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 65% at 50% 45%, oklch(0.16 0.05 264 / 0.42) 0%, oklch(0.13 0.04 264 / 0.80) 62%, oklch(0.11 0.035 264 / 0.93) 100%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        className="relative z-10 mx-4 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center">
          <Image
            src={LOGO_URL}
            alt="Alliance Investimentos"
            width={132}
            height={66}
            className="object-contain"
            priority
          />
          <p className="mt-4 text-sm text-white/60">La Reserva · Castelo, ES</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-white/10 px-7 py-7"
          style={{
            // Quase opaco de propósito: o véu de fundo é leve para a fachada
            // aparecer, então a legibilidade do formulário tem de vir do card.
            background: 'oklch(0.165 0.028 264 / 0.94)',
            boxShadow: '0 24px 64px oklch(0 0 0 / 0.5)',
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/75">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-base text-white outline-none transition-ui placeholder:text-white/30 focus-visible:border-white/30 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/25"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/75">
              Senha
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-base text-white outline-none transition-ui placeholder:text-white/30 focus-visible:border-white/30 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/25"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-[var(--danger)]/15 px-3 py-2 text-center text-sm text-white">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-surface-fixed py-2.5 text-base font-semibold text-ink-fixed transition-ui hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-ink-fixed/25 border-t-ink-fixed"
                />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </motion.div>

      <p className="absolute bottom-7 z-10 text-xs text-white/35">
        Alliance Investimentos Imobiliários · {new Date().getFullYear()}
      </p>
    </div>
  )
}
