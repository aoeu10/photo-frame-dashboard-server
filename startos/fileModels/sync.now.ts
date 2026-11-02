import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

/**
 * Flag file the Python sync loop watches: when it appears (any content), the
 * loop runs a sync immediately and deletes it. Written by the Sync Now action.
 */
const shape = z.object({
  requestedAt: z.string().catch(''),
})

export const syncNowFile = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'sync.now.json' },
  shape,
)

export async function requestSync(
  effects: Parameters<typeof syncNowFile.merge>[0],
) {
  await syncNowFile.merge(effects, { requestedAt: new Date().toISOString() })
}
