import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_53_0 = VersionInfo.of({
  version: '1.2.53:0',
  releaseNotes: {
    en_US:
      '**Clearer empty printer-search guidance.** Empty or failed searches now direct users to manual URL setup or their saved printer, without suggesting unavailable discovery choices. Includes visible fresh-scan results and the working manual selection from 1.2.52.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
