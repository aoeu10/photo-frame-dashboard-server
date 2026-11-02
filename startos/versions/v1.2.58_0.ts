import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_58_0 = VersionInfo.of({
  version: '1.2.58:0',
  releaseNotes: {
    en_US:
      '**Grocery print layout.** Store lists now print side by side in columns instead of stacked, and each quantity (x1, x2, and so on) appears directly beside its item instead of at the far right edge. Long lists still paginate within the columns.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
