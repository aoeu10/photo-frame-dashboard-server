import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { i18n } from '../i18n'

const { InputSpec, Value } = sdk

// Fixed display order, matching the dashboard's data-go values. "control" is
// the smart-home section labelled Home in the rail; Today is always first.
const SECTIONS = [
  ['home', i18n('Today')],
  ['weather', i18n('Weather')],
  ['calendar', i18n('Calendar')],
  ['photos', i18n('Photos')],
  ['meals', i18n('Meals')],
  ['school', i18n('School')],
  ['tasks', i18n('Chores')],
  ['shopping', i18n('Groceries')],
  ['vestaboard', 'Vestaboard'],
  ['control', i18n('Home controls')],
] as const

type SectionKey = (typeof SECTIONS)[number][0]

// Opt-in sections start hidden; every other section starts visible.
const DEFAULT_VISIBLE: Record<string, boolean> = { meals: false, school: false }

const VISIBLE_DESCRIPTION =
  'Show this section in the sidebar. Hidden sections stay reachable from Today cards and direct section links.'

type SidebarInput = Record<string, boolean | undefined>

export const editSidebar = sdk.Action.withInput(
  '07-edit-sidebar',
  {
    name: i18n('Edit Sidebar'),
    description:
      'Choose which sections appear in the dashboard sidebar. The order is fixed; Today always stays first. Hidden sections stay reachable from Today cards and direct section links.',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    show_home: Value.toggle({
      name: i18n('Today'),
      description: 'Today always stays first and cannot be hidden.',
      default: true,
      immutable: true,
    }),
    ...Object.fromEntries(
      SECTIONS.filter(([key]) => key !== 'home').map(([key, label]) => [
        `show_${key}`,
        Value.toggle({
          name: label,
          description: VISIBLE_DESCRIPTION,
          default: DEFAULT_VISIBLE[key] !== false,
        }),
      ]),
    ),
  }),
  // Prefill visibility from the saved list; absent entries stay visible.
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const saved = Array.isArray(cfg?.nav) ? cfg.nav : []
    const visible: SidebarInput = { show_home: true }
    for (const [key] of SECTIONS) {
      if (key === 'home') continue
      visible[`show_${key}`] = DEFAULT_VISIBLE[key] !== false
    }
    for (const item of saved) {
      const key = item?.section as SectionKey
      if (!SECTIONS.some(([candidate]) => candidate === key)) continue
      visible[`show_${key}`] = item.visible !== false
    }
    return visible
  },
  async ({ effects, input }) => {
    const values = input as SidebarInput
    const nav = SECTIONS.map(([section]) => ({
      section,
      visible: section === 'home' || values[`show_${section}`] !== false,
    }))
    await configJson.merge(effects, { nav })
    return {
      version: '1',
      title: 'Sidebar updated',
      result: null,
      message:
        'Sidebar settings saved. The frame applies them on its next one-minute refresh.',
    }
  },
)
