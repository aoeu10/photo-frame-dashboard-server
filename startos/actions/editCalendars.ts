import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { palette } from './colors'
import { calendarKind, calendarTypeConflict } from './calendarFlags'

const { InputSpec, Value, List } = sdk

const calendarSpec = InputSpec.of({
  name: Value.text({
    name: 'Name',
    description:
      'Name shown on the dashboard for this calendar, such as a person or Family.',
    required: true,
    default: null,
  }),
  color: Value.select({
    name: 'Color',
    description: 'Events from this calendar render in this color',
    default: '#111111',
    values: palette,
  }),
  url: Value.text({
    name: 'Public calendar link (ICS)',
    description:
      'Read-only. In Apple Calendar: share the calendar, enable "Public Calendar", copy the link. Private links would be stored on this box — use a calendar you are comfortable serving from your LAN.',
    required: true,
    default: null,
    patterns: [
      {
        regex: '^(https|webcal)://\\S+$',
        description: 'Use an https:// or webcal:// public calendar link.',
      },
    ],
  }),
  user: Value.dynamicSelect(async ({ effects }) => {
    const cfg = await configJson.read().const(effects)
    const values: Record<string, string> = { __none__: 'No user' }
    for (const user of cfg?.users || []) {
      values[user.name] = user.name
    }
    return {
      name: 'Assigned user',
      description:
        "This calendar is turned on by default for that user's personal home page.",
      default: '__none__',
      values,
    }
  }),
  showOnHome: Value.toggle({
    name: 'Show on Today homepage',
    description:
      "Include this calendar's events and person lane on Today. The Calendar tab always shows every configured calendar. Turned off automatically for a meal calendar.",
    default: true,
  }),
  school: Value.toggle({
    name: 'School calendar',
    description:
      'Marks this calendar as a school calendar; its events feed the School section and still appear in the Calendar tab. A calendar cannot be both school and meal.',
    default: false,
  }),
  meal: Value.toggle({
    name: 'Meal calendar',
    description:
      "Buckets this calendar's entries into Breakfast (7-9 AM), Lunch (11 AM-1 PM) and Dinner (5-7 PM) for the Meals section. Meal calendars never show on Today, and cannot also be a school calendar.",
    default: false,
  }),
})

export const editCalendars = sdk.Action.withInput(
  '03-edit-calendars',
  {
    name: 'Edit Calendars',
    description:
      "The calendars shown in the Calendar section. Each one needs a public read-only ICS link; give every calendar a color (one per household member, plus a general one). Assign a calendar to a user to turn it on by default on that user's personal home. The server fetches them; the frame never sees the links.",
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    calendars: Value.list(
      List.obj(
        {
          name: 'Calendars',
          description: 'One row per calendar. Reorder with the row controls.',
        },
        {
          spec: calendarSpec,
          displayAs:
            '{{name}}{{#user}} · {{user}}{{/user}}{{^showOnHome}} · hidden from Today{{/showOnHome}}{{#school}} · school{{/school}}{{#meal}} · meals{{/meal}}',
          uniqueBy: 'name',
        },
      ),
    ),
  }),
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const users: Record<string, true> = Object.fromEntries(
      (cfg?.users || []).map((user) => [user.name, true as const]),
    )
    return {
      calendars: (cfg?.calendars || []).map((c) => ({
        name: c.name,
        color: c.color,
        url: c.url,
        user: c.user && users[c.user] ? c.user : '__none__',
        ...calendarKind(
          c.school === true,
          c.meal === true,
          c.showOnHome !== false,
        ),
      })),
    }
  },
  async ({ effects, input }) => {
    const calendars = (input.calendars || []).filter(
      (
        c,
      ): c is {
        name: string
        color: string
        url: string
        user: string
        showOnHome: boolean
        school: boolean
        meal: boolean
      } => !!c && !!c.url && !!c.name,
    )
    if (calendarTypeConflict(calendars)) {
      return {
        version: '1',
        title: 'Calendar type conflict',
        result: null,
        message:
          'A calendar cannot be both a school calendar and a meal calendar. Choose one for each row and submit again.',
      }
    }
    await configJson.merge(effects, {
      calendars: calendars.map((c) => ({
        name: c.name.trim(),
        color: (c.color || '#111111').trim(),
        url: c.url.trim().replace(/^webcal:\/\//i, 'https://'),
        user: (c.user || '') === '__none__' ? '' : c.user || '',
        ...calendarKind(c.school, c.meal, c.showOnHome),
      })),
    })
    return {
      version: '1',
      title: 'Calendars updated',
      result: null,
      message:
        'Calendars saved. Events appear after the next sync cycle, or run **Sync Now**.',
    }
  },
)
