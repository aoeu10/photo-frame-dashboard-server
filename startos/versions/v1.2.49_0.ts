import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_49_0 = VersionInfo.of({
  version: '1.2.49:0',
  releaseNotes: {
    en_US:
      '**Printer setup guide.** Manual IPP/IPPS URL entry remains in StartOS Printer Settings. Both printer actions now link to detailed README instructions for Mac Bonjour lookups, printer/router/Windows IP lookup, constructing the full URL, saving it and keeping the address stable. Discovery limitations are explained; the dashboard still prints directly to the saved printer.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
