import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_54_0 = VersionInfo.of({
  version: '1.2.54:0',
  releaseNotes: {
    en_US:
      '**Default LAN printer scan range.** Printer Settings and the discovery API now default to 192.168.1.0/24 for missing or blank subnet settings instead of detecting a container network. Explicit custom subnets are preserved, clearing the field restores the default, and saved printer names and URLs remain unchanged.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
