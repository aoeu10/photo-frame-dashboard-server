import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_42_0 = VersionInfo.of({
  version: '1.2.42:0',
  releaseNotes: {
    en_US:
      '**Live chore updates.** An open Chores section or personal home page now repaints when the configured chore roster or users change, without navigating away and back. Saved chores, assignments, and completion behavior are unchanged.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
