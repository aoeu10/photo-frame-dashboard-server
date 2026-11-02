import { sdk } from '../sdk'
import { configJson } from '../fileModels/config.json'
import { frameCache } from '../fileModels/frame_cache.json'
import { albumRows } from './albumNames'
import { i18n } from '../i18n'

const { InputSpec, Value, List } = sdk

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

export const editPhotos = sdk.Action.withInput(
  '05-edit-photos',
  {
    name: i18n('Edit Photos & Albums'),
    description: i18n(
      'Choose the iCloud shared albums the Photos section and screensaver stream from. The box refreshes the album metadata on its sync interval; the frame loads each photo straight from Apple, and never talks to anything but your StartOS box and Apple.',
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
  }),
  // Prefill the current albums
  async ({ effects }) => {
    const cfg = await configJson.read().once()
    const cache = await frameCache.read().once()
    return {
      albums: albumRows(cfg?.albums || [], cache?.photoAlbums || []),
    }
  },
  // Handler — merge the new album list
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
    await configJson.merge(effects, { albums })
    return {
      version: '1',
      title: 'Photos updated',
      result: null,
      message:
        'Albums saved. New photos appear after the next sync cycle, or run **Sync Now**.',
    }
  },
)
