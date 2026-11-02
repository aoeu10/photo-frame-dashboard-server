import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { initializeShoppingDefaults } from '../utils'

export const v_1_2_38_0 = VersionInfo.of({
  version: '1.2.38:0',
  releaseNotes: {
    en_US:
      '**Shopping catalog and store controls.** Starter categories are now saved automatically on install and upgrade when no starter bank exists; empty category placeholders no longer disable them. Explicitly disabled or edited starters stay unchanged. All is back alongside Unspecified and named stores. Unspecified items can be assigned to a store; quantities combine if that item is already on the destination list.',
  },
  migrations: {
    up: async ({ effects }) => {
      await initializeShoppingDefaults(effects)
    },
    down: IMPOSSIBLE,
  },
})
