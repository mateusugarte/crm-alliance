'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CalendarDays, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const LEAD_LISTBOX_ID = 'lead-combobox-listbox'

export function CreateMeetingDialog({
  open,
  onClose,
  leads,
  prefillLeadId,
  onCreated,
}: CreateMeetingDialogProps) {
  const [leadId, setLeadId] = useState(prefillLeadId ?? '')
  const [comboOpen, setComboOpen] = useState(false)
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedLead = leads.find(l => l.id === leadId)

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
      setLeadId('')
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
          {/* Combobox de Lead */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-trigger">Lead</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger
                render={
                  <button
                    id="lead-trigger"
                    type="button"
                    role="combobox"
                    aria-expanded={comboOpen}
                    aria-haspopup="listbox"
                    aria-controls={LEAD_LISTBOX_ID}
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-alliance-blue cursor-pointer',
                      !selectedLead && 'text-muted-foreground'
                    )}
                  >
                    {selectedLead
                      ? `${selectedLead.name} — ${selectedLead.phone}`
                      : 'Selecionar lead...'}
                    <ChevronsUpDown size={14} className="opacity-50 flex-shrink-0 ml-2" />
                  </button>
                }
              />
              <PopoverContent
                className="p-0 w-[var(--radix-popover-trigger-width)]"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandInput placeholder="Buscar por nome..." />
                  <CommandList id={LEAD_LISTBOX_ID}>
                    <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                    <CommandGroup>
                      {leads.map(l => (
                        <CommandItem
                          key={l.id}
                          value={`${l.name} ${l.phone}`}
                          onSelect={() => {
                            setLeadId(l.id)
                            setComboOpen(false)
                          }}
                        >
                          <Check
                            size={14}
                            className={cn(
                              'mr-2 flex-shrink-0',
                              leadId === l.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="font-medium">{l.name}</span>
                          <span className="ml-1.5 text-gray-400 text-xs">{l.phone}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
              disabled={loading || !leadId}
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
