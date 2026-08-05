const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone)
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return representedAsUtc - Math.floor(date.getTime() / 1_000) * 1_000
}

function zonedDateTimeToUtc(parts: DateParts, timeZone: string) {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess), timeZone)
  const firstCandidate = new Date(utcGuess - firstOffset)
  const correctedOffset = timeZoneOffsetMs(firstCandidate, timeZone)
  return new Date(utcGuess - correctedOffset)
}

function addLocalDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  }
}

export function zonedDayRange(
  reference = new Date(),
  view: 'day' | 'week' = 'day',
  timeZone = DEFAULT_TIME_ZONE,
) {
  const current = zonedParts(reference, timeZone)
  const localDay = { ...current, hour: 0, minute: 0, second: 0 }
  const weekday = new Date(Date.UTC(current.year, current.month - 1, current.day, 12)).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const startParts = view === 'week' ? addLocalDays(localDay, -daysSinceMonday) : localDay
  const endParts = addLocalDays(startParts, view === 'week' ? 7 : 1)

  return {
    startIso: zonedDateTimeToUtc(startParts, timeZone).toISOString(),
    endExclusiveIso: zonedDateTimeToUtc(endParts, timeZone).toISOString(),
    startDate: [startParts.year, String(startParts.month).padStart(2, '0'), String(startParts.day).padStart(2, '0')].join('-'),
    endExclusiveDate: [endParts.year, String(endParts.month).padStart(2, '0'), String(endParts.day).padStart(2, '0')].join('-'),
  }
}
