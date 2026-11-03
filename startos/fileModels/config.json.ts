import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const DEFAULT_PRINTER_SCAN_SUBNET = '192.168.1.0/24'

/**
 * The dashboard service's own configuration, written to config.json on the
 * main volume. The Python sync service (service/dashboard_service.py) reads
 * this file on every cycle, so changes apply without a restart.
 *
 * Edited from StartOS through the package's Actions (Edit Photos, Edit
 * Calendars, Edit Location & Units) — each action's handler merges into this
 * file.
 */
const albumShape = z.object({
  // A public iCloud shared album link (photos.icloud.com/shared/album/<token>/
  // or www.icloud.com/sharedalbum/#<token>). "Anyone with the link" sharing.
  url: z.string().catch(''),
  name: z.string().catch(''),
})

const immichAlbumShape = z.object({
  // Base URL of the Immich server, e.g. http://192.168.1.50:2283. A reverse
  // proxy subpath is allowed. The service appends /api/... to this value.
  server: z.string().catch(''),
  // Immich API key (Account Settings -> API Keys). Needs album.read and
  // asset.view. Stays on this box; the frame only receives proxy URLs.
  apiKey: z.string().catch(''),
  // Album UUID. The action accepts an album page link and stores the UUID.
  albumId: z.string().catch(''),
  name: z.string().catch(''),
})

const calendarShape = z.object({
  name: z.string().catch(''),
  // Read-only public ICS link. Events from this calendar render in this color.
  url: z.string().catch(''),
  color: z.string().catch('#111111'),
  // The user this calendar belongs to (Edit Users name), or '' for none.
  user: z.string().catch(''),
  // Whether this calendar appears on the Today homepage. The Calendar tab
  // always lists every configured calendar.
  showOnHome: z.boolean().catch(true),
  // Marks the calendar as a school calendar; its events feed the School
  // section. A calendar cannot be both school and meal.
  school: z.boolean().catch(false),
  // Marks the calendar as the meal calendar; its events are bucketed into
  // Breakfast, Lunch and Dinner. Meal calendars never show on Today.
  meal: z.boolean().catch(false),
})

const choreShape = z.object({
  // Stable client id. The editor derives one when a row is saved.
  id: z.string().catch(''),
  title: z.string().catch(''),
  emoji: z.string().catch('✅'),
  routine: z.enum(['morning', 'after', 'evening']).catch('morning'),
  // A configured user's name, or '' for Anyone.
  user: z.string().catch(''),
  stars: z.number().catch(1),
})

const shoppingItemShape = z.object({
  name: z.string().catch(''),
  category: z.string().catch(''),
  store: z.string().catch(''),
  usual: z.boolean().catch(false),
})

const shape = z.looseObject({
  location: z
    .object({
      name: z.string().catch('Home'),
      // Decimal degrees. Used for the Open-Meteo forecast and the radar centre.
      lat: z.number().catch(0),
      lon: z.number().catch(0),
      // The US ZIP the coordinates were resolved from, if any (informational).
      zip: z.string().catch(''),
    })
    .catch(() => ({ name: 'Home', lat: 0, lon: 0, zip: '' })),
  // IANA timezone (e.g. America/Chicago). Empty = the server's zone.
  timezone: z.string().catch(''),
  units: z
    .object({
      temperature: z.enum(['fahrenheit', 'celsius']).catch('fahrenheit'),
    })
    .catch(() => ({ temperature: 'fahrenheit' as const })),
  // Minutes between sync cycles (album + calendars + weather).
  syncIntervalMinutes: z.number().catch(60),
  // Night display: the dashboard dims after idle instead of disappearing.
  // Red mode removes blue light for the hours before sleep.
  night: z
    .object({
      dim: z.boolean().catch(true),
      red: z.boolean().catch(false),
    })
    .catch(() => ({ dim: true, red: false })),
  albums: z.array(albumShape).catch([]),
  // Immich albums, fetched with an API key and proxied through this box.
  immichAlbums: z.array(immichAlbumShape).catch([]),
  calendars: z.array(calendarShape).catch([]),
  // Sidebar order and visibility. Today is always first; absent means the
  // built-in order with every section shown except the opt-in Meals and School.
  nav: z
    .array(
      z.object({
        section: z.string().catch(''),
        visible: z.boolean().catch(true),
      }),
    )
    .catch([]),
  // People shown in the top-right corner of Today, each with a personal home
  // page. "calendar" matches a configured calendar by name or key.
  users: z
    .array(
      z.object({
        name: z.string().catch(''),
        color: z.string().catch('#111111'),
        // Calendar names shown on this user's personal home. Empty means the
        // calendars assigned to this user in Edit Calendars.
        calendars: z.array(z.string()).catch([]),
        cards: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  // Saved printer for box-side grocery printing. The dashboard cannot select
  // or override it; an empty URL directs the user to StartOS Printer Settings.
  printer: z
    .object({
      name: z.string().catch(''),
      url: z.string().catch(''),
      scanSubnet: z.string().catch(DEFAULT_PRINTER_SCAN_SUBNET),
    })
    .catch(() => ({
      name: '',
      url: '',
      scanSubnet: DEFAULT_PRINTER_SCAN_SUBNET,
    })),
  // Vestaboard Local API. The key stays on the server; the dashboard only
  // receives the board size and current message.
  vestaboard: z
    .object({
      host: z.string().catch(''),
      apiKey: z.string().catch(''),
      board: z.enum(['flagship', 'note']).catch('flagship'),
    })
    .catch(() => ({ host: '', apiKey: '', board: 'flagship' as const })),
  // Chores shown in the Chores section and on Today. Absent on older configs;
  // initialization seeds the example bank once. A saved empty list stays empty.
  chores: z.array(choreShape).optional(),
  // Shopping: item catalog plus the current list. The frame writes list
  // changes through the service, so this file is shared by both.
  shopping: z
    .object({
      stores: z
        .array(
          z.object({
            name: z.string().catch(''),
          }),
        )
        .catch([]),
      categories: z.array(z.string()).catch([]),
      items: z.array(shoppingItemShape).catch([]),
      // Absent on older configs. The editor offers starters without enabling
      // them over an existing custom catalog. Empty saved starters stay empty.
      defaults: z
        .object({
          enabled: z.boolean().catch(true),
          categories: z.array(z.string()).catch([]),
          items: z.array(shoppingItemShape).catch([]),
        })
        .optional(),
      list: z
        .array(
          z.object({
            name: z.string().catch(''),
            category: z.string().catch(''),
            store: z.string().catch(''),
            qty: z.number().catch(1),
            note: z.string().catch(''),
            done: z.boolean().catch(false),
          }),
        )
        .catch([]),
    })
    .catch(() => ({ stores: [], categories: [], items: [], list: [] })),
})

export const configJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'config.json' },
  shape,
)
