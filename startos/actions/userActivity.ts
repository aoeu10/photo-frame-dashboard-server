// Per-user calendar activity shown beside each name in Edit Users, computed
// from the last completed sync snapshot.

export type SnapshotCalendar = {
  key: string
  name: string
  status: string
}

export type SnapshotEvent = {
  title: string
  start: string
  end: string
  allDay: boolean
  people: string[]
}

/** Resolve configured calendar names or keys to snapshot keys. */
export function calendarKeys(
  references: readonly string[],
  calendars: readonly SnapshotCalendar[],
): string[] {
  const keys: string[] = []
  for (const reference of references) {
    const wanted = String(reference || '')
      .trim()
      .toLowerCase()
    if (!wanted) continue
    const match = calendars.find(
      (calendar) =>
        calendar.key.toLowerCase() === wanted ||
        calendar.name.trim().toLowerCase() === wanted,
    )
    if (match && !keys.includes(match.key)) keys.push(match.key)
  }
  return keys
}

/**
 * One line of upcoming activity across the selected calendars, or a short
 * reason there is none. Times use the configured zone so the label matches
 * the frame.
 */
export function activityLabel(
  references: readonly string[],
  calendars: readonly SnapshotCalendar[],
  events: readonly SnapshotEvent[],
  timezone: string,
  now = new Date(),
): string {
  if (!references.length) return 'No calendar selected'
  const keys = calendarKeys(references, calendars)
  if (!keys.length) return 'Calendar not found'
  const usable = calendars.filter(
    (calendar) => keys.includes(calendar.key) && calendar.status === 'ok',
  )
  if (!usable.length) return 'Calendar unavailable'

  const upcoming = events
    .filter((event) => event.people.some((key) => keys.includes(key)))
    .filter((event) => new Date(event.end).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  if (!upcoming.length) return 'No upcoming events'

  const next = upcoming[0]
  const start = new Date(next.start)
  if (next.allDay) return `All day · ${next.title}`
  let time = ''
  try {
    time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    }).format(start)
  } catch {
    time = start.toISOString().slice(11, 16)
  }
  return `${time} · ${next.title}`
}
