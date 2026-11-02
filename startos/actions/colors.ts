// Shared accent palette for Edit Calendars and Edit Users. StartOS renders a
// select from these keys; the labels are what the user sees.
export const palette: Record<string, string> = {
  '#E53935': 'Red',
  '#FB8C00': 'Orange',
  '#FDD835': 'Yellow',
  '#43A047': 'Green',
  '#1E88E5': 'Blue',
  '#8E24AA': 'Purple',
  '#D81B60': 'Pink',
  '#111111': 'Black',
}

const HEX = /^#[0-9a-fA-F]{6}$/

function normalizeHex(value: string | null | undefined): string | null {
  return HEX.test(value || '') ? (value as string) : null
}

/**
 * Select values for a user's colour. Saved colours outside the palette are
 * kept as extra "Current" options so reopening the form cannot silently
 * rewrite an existing custom colour.
 */
export function userColorValues(
  users: readonly { color?: string | null }[],
): Record<string, string> {
  const values: Record<string, string> = { ...palette }
  for (const user of users) {
    const color = normalizeHex(user?.color)
    if (!color) continue
    const inPalette = Object.keys(palette).some(
      (key) => key.toLowerCase() === color.toLowerCase(),
    )
    if (!inPalette) values[color] = `Current (${color})`
  }
  return values
}

/**
 * The option to prefill for one saved colour: the palette key when the colour
 * matches case-insensitively, otherwise the custom hex itself, and Black when
 * the saved value is missing or malformed.
 */
export function userColorChoice(color: string | null | undefined): string {
  const saved = normalizeHex(color)
  if (!saved) return '#111111'
  const match = Object.keys(palette).find(
    (key) => key.toLowerCase() === saved.toLowerCase(),
  )
  return match || saved
}
