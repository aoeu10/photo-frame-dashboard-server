import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

// Read-only projection of the Python service's atomically published snapshot.
// Never merge this model: the service owns the complete frame_cache.json file.
const album = z.looseObject({
  configuredName: z.string().catch(''),
  name: z.string().catch(''),
  photoCount: z.number().catch(0),
  datedPhotoCount: z.number().catch(0),
  oldestTaken: z.string().nullable().catch(null),
  newestTaken: z.string().nullable().catch(null),
  status: z.enum(['ok', 'error', 'invalid-link']).catch('error'),
  error: z.string().nullable().catch(null),
})

const calendar = z.looseObject({
  key: z.string().catch(''),
  name: z.string().catch(''),
  color: z.string().catch('#111111'),
  status: z.string().catch(''),
})

const event = z.looseObject({
  uid: z.string().catch(''),
  title: z.string().catch(''),
  start: z.string().catch(''),
  end: z.string().catch(''),
  allDay: z.boolean().catch(false),
  people: z.array(z.string()).catch([]),
})

export const frameCache = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'frame_cache.json' },
  z.looseObject({
    generated_at: z.string().catch(''),
    photoAlbums: z.array(album).catch([]),
    calendars: z.array(calendar).catch([]),
    events: z.array(event).catch([]),
  }),
)
