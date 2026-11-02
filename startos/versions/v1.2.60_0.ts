import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_60_0 = VersionInfo.of({
  version: '1.2.60:0',
  releaseNotes: {
    en_US:
      '**Cleaner photo screensaver.** The calendar-colored people avatars below the weather are removed from the ambient photo screensaver, so the photo view shows only the clock, date, weather and next event.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
