import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { requestSync } from '../fileModels/sync.now'

export const syncNow = sdk.Action.withoutInput(
  '01-sync-now',
  {
    name: i18n('Sync Now'),
    description: i18n(
      'Fetch new photos, calendars and weather immediately instead of waiting for the next sync cycle.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  // Handler — drop a flag file the sync loop watches, then report.
  async ({ effects }) => {
    await requestSync(effects)
    return {
      version: '1',
      title: 'Sync requested',
      result: null,
      message:
        'The next sync cycle is starting now. Photos, calendars and weather refresh over the following minute or two.',
    }
  },
)
