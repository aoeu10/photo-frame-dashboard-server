import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { frameCache } from '../fileModels/frame_cache.json'
import { configJson } from '../fileModels/config.json'

function field(name: string, value: string) {
  return {
    type: 'single' as const,
    name,
    description: null,
    value,
    masked: false,
    copyable: true,
    qr: false,
    launchable: false,
  }
}

export const photoAlbumInfo = sdk.Action.withoutInput(
  '06-photo-album-info',
  async ({ effects }) => {
    const snapshot = await frameCache.read().const(effects)
    const summary = (snapshot?.photoAlbums || [])
      .map(
        (album) =>
          `${album.name || album.configuredName || 'Shared album'}: ${album.photoCount} photos${album.status === 'ok' ? '' : ' (sync error)'}`,
      )
      .join('; ')
    return {
      name: i18n('Photo Album Info'),
      description:
        i18n(
          'Show album names, photo counts, capture dates and the last sync.',
        ) + (summary ? ` ${summary}` : ''),
      warning: null,
      allowedStatuses: 'any' as const,
      group: null,
      visibility: 'enabled' as const,
    }
  },
  async () => {
    const snapshot = await frameCache.read().once()
    const configured = await configJson.read().once()
    const albums = snapshot?.photoAlbums || []
    if (!albums.length) {
      return {
        version: '1' as const,
        title: 'Photo Album Info',
        message: configured?.albums.length
          ? 'Album information is not available yet. Run **Sync Now**, then reopen this action.'
          : 'No shared albums are configured. Add an album in **Edit Photos & Albums**.',
        result: null,
      }
    }
    return {
      version: '1' as const,
      title: 'Photo Album Info',
      message: `Snapshot from the last completed sync: ${snapshot?.generated_at || 'unknown'}.\nCapture dates are supplied by Apple, not the date photos were added to the album. Reopen this action after **Sync Now** to see updated information.`,
      result: {
        type: 'group' as const,
        value: albums.map((album) => ({
          type: 'group' as const,
          name: album.name || album.configuredName || 'Shared album',
          description: null,
          value: [
            field('Album name', album.name || 'Not supplied by Apple'),
            field(
              'Dashboard label',
              album.configuredName || album.name || 'Shared album',
            ),
            field('Photos', String(album.photoCount)),
            field(
              'Capture dates available',
              `${album.datedPhotoCount} of ${album.photoCount}`,
            ),
            field('Oldest capture date', album.oldestTaken || 'Unavailable'),
            field('Newest capture date', album.newestTaken || 'Unavailable'),
            field(
              'Sync status',
              album.status === 'ok' ? 'OK' : album.error || 'Album sync failed',
            ),
          ],
        })),
      },
    }
  },
)
