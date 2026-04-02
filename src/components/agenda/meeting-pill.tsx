import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { MeetingWithLead } from './types'

interface MeetingPillProps {
  meeting: MeetingWithLead
  onClick?: () => void
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

export function MeetingPill({ meeting, onClick }: MeetingPillProps) {
  const time = format(new Date(meeting.datetime), 'HH:mm', { locale: ptBR })
  const maxChars = 10
  const name = meeting.lead_name.length > maxChars
    ? meeting.lead_name.slice(0, maxChars) + '…'
    : meeting.lead_name

  const color = meeting.consultant_color || '#0A2EAD'
  const rgb = color.startsWith('#') && color.length === 7 ? hexToRgb(color) : '10,46,173'

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold truncate max-w-full transition-opacity',
        onClick && 'cursor-pointer hover:opacity-80',
      )}
      style={{
        backgroundColor: `rgba(${rgb}, 0.15)`,
        color: color,
      }}
      title={`${time} — ${meeting.lead_name} (${meeting.consultant_name})`}
    >
      <span className="font-mono text-[10px] opacity-70">{time}</span>
      <span>{name}</span>
    </span>
  )
}
