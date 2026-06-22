'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Send, Trash2, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { LeadComment } from '@/lib/supabase/types'

interface LeadCommentsSectionProps {
  leadId: string
  currentUserId: string
}

export function LeadCommentsSection({ leadId, currentUserId }: LeadCommentsSectionProps) {
  const [comments, setComments] = useState<LeadComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/leads/${leadId}/comments`)
      .then(r => r.json() as Promise<{ data: LeadComment[] }>)
      .then(json => setComments(json.data ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`comments-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_comments', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          setComments(prev => {
            const c = payload.new as LeadComment
            if (prev.some(x => x.id === c.id)) return prev
            return [...prev, c]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [leadId])

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments])

  const handleSubmit = async () => {
    const text = newComment.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: LeadComment }
      setComments(prev => [...prev, json.data])
      setNewComment('')
    } catch {
      toast.error('Erro ao adicionar comentário')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      const res = await fetch(`/api/leads/${leadId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {
      toast.error('Erro ao excluir comentário')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-gray-300" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
            <StickyNote size={18} className="text-gray-200" />
            <p className="text-xs text-gray-300">Nenhum comentário ainda.</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex items-start gap-1.5 group">
              <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    {c.user_name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {format(new Date(c.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 p-1 text-gray-300 hover:text-red-400 disabled:opacity-40 cursor-pointer rounded-lg hover:bg-red-50"
                  aria-label="Excluir comentário"
                >
                  {deletingId === c.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />
                  }
                </button>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Comentário interno... (Enter para enviar)"
          rows={2}
          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue/40 leading-snug"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          aria-label="Enviar comentário"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-alliance-dark text-white rounded-full hover:bg-alliance-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
        >
          {submitting
            ? <Loader2 size={13} className="animate-spin" />
            : <Send size={13} />
          }
        </button>
      </div>
    </div>
  )
}
