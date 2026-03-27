'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import BlobBottom from '@/components/layout/blob-bottom'
import { signIn } from './actions'

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
    <div className="relative flex flex-col items-center justify-center h-screen w-full overflow-hidden bg-white">
      {/* Logo */}
      <div className="absolute top-6 left-6 z-10">
        <span className="text-alliance-dark font-bold text-2xl tracking-tight">Alliance</span>
      </div>

      {/* Título */}
      <div className="z-10 text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-4xl font-bold text-alliance-blue uppercase tracking-wider"
        >
          Bem-vindo
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-2 text-alliance-blue/60 text-xs uppercase tracking-[0.25em]"
        >
          Faça o login para acessar
        </motion.p>
      </div>

      {/* Card flutuante */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="z-10 w-full max-w-sm mx-4"
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl px-8 py-8 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-alliance-blue/80 uppercase tracking-wider">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="seu@email.com"
              className="rounded-xl bg-alliance-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-alliance-blue/30 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-alliance-blue/80 uppercase tracking-wider">
              Senha
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="rounded-xl bg-alliance-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-alliance-blue/30 transition"
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-full bg-alliance-dark text-white font-semibold py-3 text-sm uppercase tracking-wider hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>
        </form>
      </motion.div>

      <BlobBottom />
    </div>
  )
}
