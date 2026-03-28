'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays } from 'lucide-react'

interface Lead {
  id: string
  name: string
  phone: string
}

interface CreateMeetingDialogProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
  prefillLeadId?: string
  onCreated: () => void
}

export function CreateMeetingDialog({
  open,
  onClose,
  leads,
  prefillLeadId,
  onCreated,
}: CreateMeetingDialogProps) {
  const [leadId, setLeadId] = useState(prefillLeadId ?? '')
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadId || !dateStr) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          datetime: new Date(dateStr).toISOString(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Erro ao criar reunião')
        return
      }

      onCreated()
      onClose()
      setNotes('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-alliance-dark">
            <CalendarDays size={18} />
            Nova Reunião
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead">Lead</Label>
            <select
              id="lead"
              value={leadId}
              onChange={e => setLeadId(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-alliance-blue"
              required
            >
              <option value="">Selecionar lead...</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="datetime">Data e hora</Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Reunião via Meet, link enviado pelo WhatsApp"
              className="rounded-xl"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-alliance-dark hover:bg-alliance-dark/90"
            >
              {loading ? 'Criando...' : 'Criar Reunião'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
