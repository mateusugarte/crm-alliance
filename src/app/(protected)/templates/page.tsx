'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Plus, RefreshCw, X, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Database, Template } from '@/lib/supabase/types'

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image:    'Imagem',
  video:    'Vídeo',
  document: 'Documento',
}

function createSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

interface FormState {
  name: string
  content: string
  media_url: string
  media_type: string
}

const EMPTY_FORM: FormState = {
  name: '',
  content: '',
  media_url: '',
  media_type: 'image',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createSupabase()
      const { data } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })
      setTemplates((data ?? []) as Template[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditing(t)
    setForm({
      name: t.name,
      content: t.content,
      media_url: t.media_url ?? '',
      media_type: t.media_type ?? 'image',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const supabase = createSupabase()
      const payload = {
        name: form.name.trim(),
        content: form.content.trim(),
        media_url: form.media_url.trim() || null,
        media_type: form.media_url.trim() ? form.media_type : null,
      }

      if (editing) {
        await supabase.from('templates').update(payload as never).eq('id', editing.id)
      } else {
        await supabase.from('templates').insert(payload as never)
      }

      setModalOpen(false)
      await loadTemplates()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const supabase = createSupabase()
      await supabase.from('templates').delete().eq('id', id)
      setDeleteConfirm(null)
      await loadTemplates()
    } catch { /* silent */ }
    setDeleting(false)
  }

  return (
    <div className="px-8 py-7 flex flex-col gap-6 min-h-full max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
            Mensagens
          </p>
          <h1 className="text-2xl font-bold text-alliance-dark dark:text-white">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Templates de mensagem para campanhas de disparo</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw size={15} className={cn('text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-alliance-blue text-white text-sm font-semibold hover:bg-alliance-dark transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Novo Template
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Templates</h2>
          <span className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={36} className="text-muted-foreground/20" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Nenhum template</p>
              <p className="text-xs text-muted-foreground mt-1">Crie templates para usar nas campanhas de disparo</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mídia</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map(t => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{t.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground max-w-xs">
                    {t.content.length > 80 ? `${t.content.slice(0, 80)}…` : t.content}
                  </td>
                  <td className="px-5 py-3.5">
                    {t.media_type ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {MEDIA_TYPE_LABELS[t.media_type] ?? t.media_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">
                    {format(new Date(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil size={13} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <h2 className="text-base font-bold text-foreground">
                  {editing ? 'Editar Template' : 'Novo Template'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do template"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Conteúdo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Texto da mensagem..."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    URL de Mídia (opcional)
                  </label>
                  <input
                    type="url"
                    value={form.media_url}
                    onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30 placeholder:text-muted-foreground/50"
                  />
                </div>

                {form.media_url.trim() && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tipo de Mídia
                    </label>
                    <select
                      value={form.media_type}
                      onChange={e => setForm(f => ({ ...f, media_type: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-alliance-blue/30"
                    >
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                      <option value="document">Documento</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.content.trim() || saving}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
                    form.name.trim() && form.content.trim() && !saving
                      ? 'bg-alliance-blue text-white hover:bg-alliance-dark'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  {saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : (editing ? 'Salvar' : 'Criar')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-base font-bold text-foreground mb-2">Excluir template?</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Esta ação não pode ser desfeita. O template será removido permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
