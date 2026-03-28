import type { MeetingWithLead } from './types'

interface MeetingPillProps {
  meeting: MeetingWithLead
}

export function MeetingPill({ meeting }: MeetingPillProps) {
  const name = meeting.consultant_name.length > 12
    ? meeting.consultant_name.slice(0, 12) + '…'
    : meeting.consultant_name

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white font-medium truncate max-w-full"
      style={{ backgroundColor: meeting.consultant_color }}
      title={`${meeting.lead_name} — ${meeting.consultant_name}`}
    >
      {name}
    </span>
  )
}
