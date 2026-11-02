import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { initializeChores } from '../utils'

export const v_1_2_41_0 = VersionInfo.of({
  version: '1.2.41:0',
  releaseNotes: {
    en_US:
      '**Editable chores.** Edit Chores lists the example chores, each with a title, optional emoji, routine, star value, and an assigned user or Anyone. Rename, reassign, or remove any row. This upgrade saves the examples once; later edits and removals stay saved. Chores lanes and personal chore cards follow the assignments.',
  },
  migrations: {
    up: async ({ effects }) => {
      await initializeChores(effects)
    },
    down: IMPOSSIBLE,
  },
})
