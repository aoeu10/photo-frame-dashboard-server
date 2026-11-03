import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { frameCache } from '../fileModels/frame_cache.json'
import { albumRows, immichAlbumRows } from './albumNames'
import { i18n } from '../i18n'

const { InputSpec, Value, List } = sdk

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const albumSpec = InputSpec.of({
  url: Value.text({
    name: i18n('Shared album link'),
    description: i18n(
      'A public iCloud shared album link: https://photos.icloud.com/shared/album/<token>/ or https://www.icloud.com/sharedalbum/#<token>. The album must use "Anyone with the Link" sharing.',
    ),
    required: false,
    default: null,
    patterns: [
      {
        regex:
          '^https://(?:photos\\.icloud\\.com(?:\\.cn)?/shared/album/[A-Za-z0-9_-]{10,200}/?|(?:www\\.)?icloud\\.com(?:\\.cn)?/sharedalbum/?#[A-Za-z0-9_-]{10,200})$',
        description: i18n('Must be a public iCloud shared album link'),
      },
    ],
  }),
  name: Value.text({
    name: i18n('Name (optional)'),
    description: i18n('A label for this album'),
    required: false,
    default: null,
  }),
  albumName: Value.text({
    name: i18n('Album name'),
    description: i18n('The album name Apple reports. Read-only.'),
    required: false,
    default: null,
  }).withDisabled(
    'From the last completed sync. Run Sync Now, then reopen this action to refresh it.',
  ),
})

const immichAlbumSpec = InputSpec.of({
  server: Value.text({
    name: i18n('Immich server URL'),
    description: i18n(
      'Base URL of your Immich server, for example http://192.168.1.50:2283 or https://photos.example.com. A reverse-proxy subpath such as https://example.com/immich is allowed.',
    ),
    required: false,
    default: null,
  }),
  apiKey: Value.text({
    name: i18n('Immich API key'),
    description: i18n(
      'In Immich, open Account Settings → API Keys and create a key with album.read, asset.view and asset.read permissions (asset.read is used for album asset search on newer Immich). Leave blank to keep the saved key.',
    ),
    required: false,
    default: null,
  }),
  album: Value.text({
    name: i18n('Immich album link or ID'),
    description: i18n(
      'Paste the album page link, for example https://your-immich/albums/<id>, or the album ID. The API key must be able to read this album.',
    ),
    required: false,
    default: null,
  }),
  name: Value.text({
    name: i18n('Name (optional)'),
    description: i18n('A label for this album'),
    required: false,
    default: null,
  }),
  albumName: Value.text({
    name: i18n('Album name'),
    description: i18n('The album name Immich reports. Read-only.'),
    required: false,
    default: null,
  }).withDisabled(
    'From the last completed sync. Run Sync Now, then reopen this action to refresh it.',
  ),
})

function normalizeImmichServer(value: string): string {
  const raw = value.trim()
  if (!raw) {
    throw new Error('Enter the Immich server URL.')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(
      'Enter a full Immich server URL, for example http://192.168.1.50:2283.',
    )
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      'The Immich server URL must start with http:// or https://.',
    )
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Enter only the Immich server base URL, without credentials, a query or a fragment.',
    )
  }
  return url.origin + url.pathname.replace(/\/+$/, '')
}

function parseImmichAlbumId(value: string): string {
  const raw = value.trim()
  if (UUID_RE.test(raw)) return raw.toLowerCase()
  try {
    const url = new URL(raw)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const match = /\/albums\/([0-9a-f-]{36})\/?$/i.exec(url.pathname)
      if (match && UUID_RE.test(match[1])) return match[1].toLowerCase()
    }
  } catch {
    // Fall through to the shared error below.
  }
  throw new Error('Enter an Immich album link or album ID.')
}

function serverFromAlbumLink(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const prefix = url.pathname.replace(/\/albums\/[0-9a-f-]{36}\/?$/i, '')
    if (prefix === url.pathname) return null
    return normalizeImmichServer(url.origin + prefix)
  } catch {
    return null
  }
}

export const editPhotos = sdk.Action.withInput(
  '05-edit-photos',
  {
    name: i18n('Edit Photos & Albums'),
    description: i18n(
      'Choose the albums the Photos section and screensaver stream from. Public iCloud shared albums and Immich albums are both supported. The box refreshes album metadata on its sync interval; Immich images are served through this box, so the frame never contacts your Immich server directly and the API key stays on this box.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  InputSpec.of({
    albums: Value.list(
      List.obj(
        { name: i18n('Albums') },
        {
          spec: albumSpec,
          displayAs:
            '{{#albumName}}{{albumName}}{{/albumName}}{{^albumName}}{{#name}}{{name}}{{/name}}{{^name}}{{url}}{{/name}}{{/albumName}}',
          uniqueBy: 'url',
        },
      ),
    ),
    immichAlbums: Value.list(
      List.obj(
        { name: i18n('Immich albums') },
        {
          spec: immichAlbumSpec,
          displayAs:
            '{{#albumName}}{{albumName}}{{/albumName}}{{^albumName}}{{#name}}{{name}}{{/name}}{{^name}}{{album}}{{/name}}{{/albumName}}',
          uniqueBy: 'album',
        },
      ),
    ),
  }),
  // Prefill the current albums
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const cache = await frameCache.read().once()
    return {
      albums: albumRows(cfg?.albums || [], cache?.photoAlbums || []),
      immichAlbums: immichAlbumRows(
        cfg?.immichAlbums || [],
        cache?.photoAlbums || [],
      ),
    }
  },
  // Handler — merge the new album lists
  async ({ effects, input }) => {
    const albums = (input.albums || [])
      .filter(
        (
          a,
        ): a is {
          url: string
          name: string | null
          albumName: string | null
        } => !!a && !!a.url,
      )
      .map((a) => ({ url: a.url.trim(), name: (a.name || '').trim() }))

    const existing = (await configJson.read().once())?.immichAlbums || []
    const savedKeys = new Map<string, string>()
    for (const album of existing) {
      try {
        savedKeys.set(
          normalizeImmichServer(album.server || ''),
          album.apiKey || '',
        )
      } catch {
        // A malformed saved row cannot supply a key.
      }
    }

    const rows = (input.immichAlbums || []).filter(
      (row) => row && ((row.server || '').trim() || (row.album || '').trim()),
    )
    const parsed = rows.map((row) => {
      const album = (row.album || '').trim()
      if (!album) {
        throw new Error('Enter an Immich album link or album ID for every row.')
      }
      const albumId = parseImmichAlbumId(album)
      const server = (row.server || '').trim()
        ? normalizeImmichServer(row.server || '')
        : serverFromAlbumLink(album)
      if (!server) {
        throw new Error(
          'Enter the Immich server URL, or paste the full album page link.',
        )
      }
      return {
        server,
        albumId,
        apiKey: (row.apiKey || '').trim(),
        name: (row.name || '').trim(),
      }
    })

    // One key per server. A newly typed key applies to every row on that
    // server whose own key field is blank.
    const providedKeys = new Map<string, string>()
    for (const row of parsed) {
      if (row.apiKey) providedKeys.set(row.server, row.apiKey)
    }

    const seen = new Set<string>()
    const immichAlbums = parsed
      .map((row) => ({
        server: row.server,
        albumId: row.albumId,
        apiKey:
          row.apiKey ||
          providedKeys.get(row.server) ||
          savedKeys.get(row.server) ||
          '',
        name: row.name,
      }))
      .filter((row) => {
        const key = `${row.server}|${row.albumId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    if (immichAlbums.some((album) => !album.apiKey)) {
      throw new Error(
        'An Immich API key is required for each new server. Create one in Immich under Account Settings → API Keys.',
      )
    }

    await configJson.merge(effects, { albums, immichAlbums })
    return {
      version: '1',
      title: 'Photos updated',
      result: null,
      message:
        'Albums saved. New photos appear after the next sync cycle, or run **Sync Now**.',
    }
  },
)
