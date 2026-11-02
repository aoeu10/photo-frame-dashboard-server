import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_43_0 = VersionInfo.of({
  version: '1.2.43:0',
  releaseNotes: {
    en_US:
      '**Mid-Day routine.** The 11 AM–5 PM routine is now labelled Mid-Day instead of After school in the Chores tab and Edit Chores. Saved chores stay in the same routine; no reassignment is needed.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
