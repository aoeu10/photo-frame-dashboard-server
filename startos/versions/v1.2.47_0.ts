import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_47_0 = VersionInfo.of({
  version: '1.2.47:0',
  releaseNotes: {
    en_US:
      '**Printer Settings LAN discovery.** The Printer Settings action now runs a live search for Bonjour/AirPrint printers when opened. You can select a printer from the local network instead of typing the URL manually. A manual URL field remains available as a fallback.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
