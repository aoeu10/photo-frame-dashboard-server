import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_51_0 = VersionInfo.of({
  version: '1.2.51:0',
  releaseNotes: {
    en_US:
      '**Printer discovery inside settings.** Printer Settings is now the only printer action and searches the LAN when opened. A single discovered printer prefills an unset name and URL; multiple results can be selected. Existing saved printers are preserved, and failed or empty searches still allow manual URL entry. Submit saves the chosen or edited printer for one-button background printing.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
