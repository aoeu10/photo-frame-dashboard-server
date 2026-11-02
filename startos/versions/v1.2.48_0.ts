import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_48_0 = VersionInfo.of({
  version: '1.2.48:0',
  releaseNotes: {
    en_US:
      '**One-button grocery printing.** Save the printer once in StartOS Printer Settings, then press Print on Groceries to send the list in the background. Browser printing, dashboard printer selection and URL entry are removed. Printing uses the saved printer without waiting for discovery. Printer Settings opens without scanning; discovery is a separate action and reports startup errors.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
