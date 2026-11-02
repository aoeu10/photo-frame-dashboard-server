export type Chore = {
  id: string
  title: string
  emoji: string
  routine: 'morning' | 'after' | 'evening'
  user: string
  stars: number
}

// Existing demo chores, without fictional assignments or completion history.
// Repeated chores within a routine are one example; users can add more rows.
export function exampleChores(): Chore[] {
  const rows: [Chore['routine'], string, string, number][] = [
    ['morning', 'Make bed', '🛏️', 1],
    ['morning', 'Brush teeth', '🪥', 1],
    ['morning', 'Pack backpack', '🎒', 1],
    ['morning', 'Get dressed', '👕', 1],
    ['morning', 'School drop-off', '🚗', 0],
    ['morning', 'Pack lunches', '🥪', 0],
    ['morning', 'Feed Biscuit', '🐶', 1],
    ['after', 'Unpack lunchbox', '🥪', 1],
    ['after', 'Homework', '📚', 2],
    ['after', 'Pack soccer bag', '⚽', 1],
    ['after', 'Read for 20 min', '📖', 2],
    ['after', 'Practice piano', '🎹', 2],
    ['after', 'Tidy the Lego', '🧱', 1],
    ['after', 'Take out recycling', '♻️', 0],
    ['after', 'Call the plumber', '☎️', 0],
    ['after', 'Fold laundry', '🧺', 0],
    ['after', 'Order Zoe’s gift', '🎁', 0],
    ['after', 'Water the plants', '🪴', 1],
    ['after', 'Empty dishwasher', '🍽️', 2],
    ['after', 'Walk Biscuit', '🐕', 2],
    ['evening', 'Set the table', '🍴', 1],
    ['evening', 'Lay out clothes', '👕', 1],
    ['evening', 'Shower', '🚿', 1],
    ['evening', 'Clear plates', '🍽️', 1],
    ['evening', 'Bath', '🛁', 1],
    ['evening', 'Lock up', '🔐', 0],
    ['evening', 'Run dishwasher', '🫧', 0],
    ['evening', 'Wipe counters', '🧽', 1],
    ['evening', 'Garbage to curb', '🗑️', 2],
  ]
  return rows.map(([routine, title, emoji, stars], index) => ({
    id: `example-${index + 1}`,
    title,
    emoji,
    routine,
    user: '',
    stars,
  }))
}
