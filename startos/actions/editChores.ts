import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { exampleChores, type Chore } from './choreExamples'

const { InputSpec, Value, List } = sdk

export const CHORE_ROUTINES = {
  morning: 'Morning',
  after: 'Mid-Day',
  evening: 'Evening',
} as const

export type ChoreRoutine = keyof typeof CHORE_ROUTINES

export type ChoreRow = {
  title: string
  emoji: string | null
  routine: ChoreRoutine
  user: string
  stars: number
}

export function userOptions(
  users: readonly { name: string }[],
  extra: readonly string[] = [],
): Record<string, string> {
  const values: Record<string, string> = { any: 'Anyone' }
  for (const user of users) values[`user:${user.name}`] = user.name
  for (const name of extra) {
    const key = `user:${name}`
    if (!(key in values)) values[key] = `${name} (not configured)`
  }
  return values
}

export function configToChoreRows(chores: readonly Chore[]): ChoreRow[] {
  return chores.map((chore) => ({
    title: chore.title,
    emoji: chore.emoji || null,
    routine: chore.routine,
    user: chore.user ? `user:${chore.user}` : 'any',
    stars: chore.stars,
  }))
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'chore'
  )
}

function choreId(
  routine: ChoreRoutine,
  title: string,
  used: Set<string>,
): string {
  const base = `${routine}-${slug(title)}`
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

export function choreRowsToConfig(rows: readonly ChoreRow[]): Chore[] {
  const used = new Set<string>()
  const chores: Chore[] = []
  for (const row of rows) {
    const title = (row?.title || '').trim()
    if (!title) continue
    const routine: ChoreRoutine =
      row.routine === 'after' || row.routine === 'evening'
        ? row.routine
        : 'morning'
    const assigned = row.user || 'any'
    const user = assigned === 'any' ? '' : assigned.replace(/^user:/, '')
    const stars = Number.isFinite(row.stars)
      ? Math.max(0, Math.min(10, Math.round(row.stars)))
      : 1
    chores.push({
      id: choreId(routine, title, used),
      title,
      emoji: (row.emoji || '').trim() || '✅',
      routine,
      user,
      stars,
    })
  }
  return chores
}

const choreSpec = InputSpec.of({
  title: Value.text({
    name: 'Chore',
    description: 'Shown in its routine lane, such as Make bed.',
    required: true,
    default: null,
  }),
  emoji: Value.text({
    name: 'Emoji',
    description:
      'Optional icon shown beside the chore, such as 🛏️. Blank uses ✅.',
    required: false,
    default: null,
  }),
  routine: Value.select({
    name: 'Routine',
    description: 'Which time-of-day tab shows this chore.',
    default: 'morning',
    values: CHORE_ROUTINES,
  }),
  user: Value.dynamicSelect(async ({ effects }) => {
    const cfg = await configJson.read().const(effects)
    const saved = (cfg?.chores || [])
      .map((chore) => chore.user)
      .filter((name) => !!name)
    return {
      name: 'Assigned to',
      description:
        'Anyone lets any household member complete it. Users come from Edit Users.',
      default: 'any',
      values: userOptions(cfg?.users || [], [...new Set(saved)]),
    }
  }),
  stars: Value.number({
    name: 'Stars',
    description:
      'Optional reward value shown beside the chore. Star totals are not persisted.',
    required: true,
    default: 1,
    min: 0,
    max: 10,
    integer: true,
  }),
})

export const editChores = sdk.Action.withInput(
  '09-edit-chores',
  {
    name: 'Edit Chores',
    description:
      'Edit the chores shown in the Chores section and on Today. Each chore belongs to a routine and is assigned to a configured user or Anyone. The current examples are prefilled and can be renamed, reassigned, or removed.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    chores: Value.list(
      List.obj(
        {
          name: 'Chores',
          description:
            'One row per chore. Reorder with the row controls. Removing a row removes it from the dashboard.',
        },
        {
          spec: choreSpec,
          displayAs: '{{emoji}} {{title}}',
        },
      ),
    ),
  }),
  async () => {
    const cfg = await configJson.read().once()
    return {
      chores: configToChoreRows(cfg?.chores ?? exampleChores()),
    }
  },
  async ({ effects, input }) => {
    await configJson.merge(effects, {
      chores: choreRowsToConfig((input.chores || []) as ChoreRow[]),
    })
    return {
      version: '1',
      title: 'Chores updated',
      result: null,
      message:
        'Chores saved. The frame applies them on its next one-minute refresh; no reload is needed. Completion marks are per screen session.',
    }
  },
)
