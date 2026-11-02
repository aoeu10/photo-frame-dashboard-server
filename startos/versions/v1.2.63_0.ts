import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_63_0 = VersionInfo.of({
  version: '1.2.63:0',
  releaseNotes: {
    en_US:
      '**Today respects hidden calendars.** When no calendars are marked Show on Today, the hero and Tomorrow line no longer borrow events from hidden calendars. Ambient mode still uses every calendar.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
