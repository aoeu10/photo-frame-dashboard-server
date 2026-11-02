import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_50_0 = VersionInfo.of({
  version: '1.2.50:0',
  releaseNotes: {
    en_US:
      '**Local-subnet printer discovery.** Discover Printers now combines Bonjour with direct private IPv4 subnet scans on ports 631/443 and read-only IPP capability queries. Select a PDF-capable printer and save its URL without typing. Printer Settings adds an optional Scan subnet override for container or larger networks. Manual URL entry and one-button background printing remain available.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
