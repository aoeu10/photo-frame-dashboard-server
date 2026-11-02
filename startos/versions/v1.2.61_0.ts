import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_61_0 = VersionInfo.of({
  version: '1.2.61:0',
  releaseNotes: {
    en_US:
      '**Personal page day summary.** The duplicate Next up hero is replaced by a one-line summary such as "3 events left today · next at 3:00 PM", followed by that person\'s agenda. In-progress events read "in progress"; with nothing left, the page shows "Free the rest of the day".',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
