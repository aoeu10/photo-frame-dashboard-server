import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_40_0 = VersionInfo.of({
  version: '1.2.40:0',
  releaseNotes: {
    en_US:
      '**Compact shopping entry.** The Add an item control is smaller, with less padding, a smaller plus icon and text, and a 48px-tall input. More room remains for the catalog without changing shopping list behavior.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
