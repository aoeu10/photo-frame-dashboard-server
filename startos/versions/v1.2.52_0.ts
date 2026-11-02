import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_52_0 = VersionInfo.of({
  version: '1.2.52:0',
  releaseNotes: {
    en_US:
      '**Clear printer discovery results and working manual setup.** Printer Settings now visibly lists fresh discovery results and distinguishes rediscovered URLs from saved settings, including empty or failed searches. The manual name/URL option is selected by default and no longer triggers a required-field error, so saved URLs can be submitted, edited or cleared even when discovery finds nothing.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
