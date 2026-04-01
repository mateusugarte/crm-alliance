import { cn } from '@/lib/utils'
import type { MeetingWithLead } from './types'

interface MeetingPillProps {
  meeting: MeetingWithLead
  onClick?: () => void
}

export function MeetingPill({ meeting, onClick }: MeetingPillProps) {
  const name = meeting.lead_name.length > 14
    ? meeting.lead_name.slice(0, 14) + '…'
    : meeting.lead_name

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white font-medium truncate max-w-full transition-opacity',
        onClick && 'cursor-pointer hover:opacity-80',
      )}
      style={{ backgroundColor: meeting.consultant_color }}
      title={`${meeting.lead_name} — ${meeting.consultant_name}`}
    >
      {name}
    </span>
  )
}
