import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { frameCache } from '../fileModels/frame_cache.json'
import { activityLabel } from './userActivity'
import { userColorChoice, userColorValues } from './colors'

const { InputSpec, Value, List } = sdk

const CARD_VALUES: Record<string, string> = {
  calendar: 'Calendar',
  weather: 'Weather',
  photos: 'Photos',
  chores: 'Chores',
  shopping: 'Groceries',
  home: 'Home controls',
}

const DEFAULT_CARDS = ['calendar', 'weather', 'photos']

const userSpec = InputSpec.of({
  name: Value.text({
    name: 'Name',
    description: 'Shown in the top-right corner of Today.',
    required: true,
    default: null,
  }),
  color: Value.dynamicSelect(async ({ effects }) => {
    const cfg = await configJson.read().const(effects)
    return {
      name: 'Color',
      description: "Accent colour shown beside this person's name.",
      default: '#111111',
      values: userColorValues(cfg?.users || []),
    }
  }),
  calendars: Value.dynamicMultiselect(async ({ effects }) => {
    const cfg = await configJson.read().const(effects)
    const values: Record<string, string> = {}
    for (const calendar of cfg?.calendars || []) {
      values[calendar.name] = calendar.name
    }
    return {
      name: 'Calendars',
      description:
        "Calendars shown on this user's personal home. Calendars assigned to this user in Edit Calendars are selected by default.",
      default: [],
      values,
    }
  }),
  cards: Value.multiselect({
    name: 'Personal home cards',
    description: "Cards shown on this user's personal home page.",
    values: CARD_VALUES,
    default: DEFAULT_CARDS,
  }),
  activity: Value.text({
    name: 'Calendar activity',
    description: 'From the last completed sync.',
    required: false,
    default: null,
  }).withDisabled(
    'Read-only. Run Sync Now, then reopen this action for fresh activity.',
  ),
})

type Row = {
  name: string
  color: string | null
  calendars: string[]
  cards: string[]
  activity: string | null
}

export const editUsers = sdk.Action.withInput(
  '04-edit-users',
  {
    name: 'Edit Users',
    description:
      "Create the people shown in the top-right corner of Today. Each row shows that user's next calendar activity beside the name, and opens their personal home page.",
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    users: Value.list(
      List.obj(
        {
          name: 'Users',
          description: 'Add a row per person. Reorder with the row controls.',
        },
        {
          spec: userSpec,
          displayAs: '{{name}}{{#activity}} · {{activity}}{{/activity}}',
          uniqueBy: 'name',
        },
      ),
    ),
  }),
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const snapshot = await frameCache.read().once()
    const timezone = cfg?.timezone || ''
    const known: Record<string, true> = Object.fromEntries(
      (cfg?.calendars || []).map((calendar) => [calendar.name, true as const]),
    )
    const users = (cfg?.users || []).map((user) => {
      const assigned = (cfg?.calendars || [])
        .filter(
          (calendar) =>
            !!calendar.user &&
            calendar.user.toLowerCase() === user.name.toLowerCase(),
        )
        .map((calendar) => calendar.name)
      const selected = Array.isArray(user.calendars)
        ? user.calendars.filter((name) => known[name])
        : []
      const calendars = selected.length ? selected : assigned
      return {
        name: user.name,
        color: userColorChoice(user.color),
        calendars,
        cards: user.cards?.length ? user.cards : [...DEFAULT_CARDS],
        activity: activityLabel(
          calendars,
          snapshot?.calendars || [],
          snapshot?.events || [],
          timezone,
        ),
      }
    })
    return { users }
  },
  async ({ effects, input }) => {
    const rows = (input.users || []) as Row[]
    const cfg = await configJson.read().once()
    const known: Record<string, true> = Object.fromEntries(
      (cfg?.calendars || []).map((calendar) => [calendar.name, true as const]),
    )
    const users = rows
      .filter((row) => !!row && !!row.name?.trim())
      .map((row) => ({
        name: row.name.trim(),
        color: /^#[0-9a-fA-F]{6}$/.test(row.color || '')
          ? (row.color as string)
          : '#111111',
        calendars: (row.calendars || []).filter((name) => known[name]),
        cards: (row.cards || []).filter((card) => card in CARD_VALUES),
      }))
    await configJson.merge(effects, { users })
    return {
      version: '1',
      title: 'Users updated',
      result: null,
      message:
        'Users saved. The frame shows them on its next one-minute refresh; no reload is needed.',
    }
  },
)
