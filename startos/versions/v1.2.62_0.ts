import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_62_0 = VersionInfo.of({
  version: '1.2.62:0',
  releaseNotes: {
    en_US:
      '**Personal pages respect an empty calendar selection.** A user with no calendars selected now sees "No calendar selected" and an empty agenda instead of another person\'s calendar events.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
