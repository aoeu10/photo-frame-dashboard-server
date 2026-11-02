export type CalendarKind = {
  school: boolean
  meal: boolean
  showOnHome: boolean
}

/**
 * Normalize a calendar's type flags. A row cannot be both school and meal:
 * school wins, and meal is dropped. A meal calendar never appears on Today.
 */
export function calendarKind(
  school: boolean,
  meal: boolean,
  showOnHome: boolean,
): CalendarKind {
  const isSchool = school === true
  const isMeal = meal === true && !isSchool
  return {
    school: isSchool,
    meal: isMeal,
    showOnHome: !isMeal && showOnHome !== false,
  }
}

/** True when any submitted row asks for both school and meal. */
export function calendarTypeConflict(
  rows: readonly { school: boolean; meal: boolean }[],
): boolean {
  return rows.some((row) => row.school === true && row.meal === true)
}
