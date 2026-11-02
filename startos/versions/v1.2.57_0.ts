import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_57_0 = VersionInfo.of({
  version: '1.2.57:0',
  releaseNotes: {
    en_US:
      '**Reorganized documentation.** The README now describes the frame features in plain language with screenshot placeholders, adds a StartOS app screenshot section, and explains every Actions & Config setting in detail. Technical implementation notes moved to their own section.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
