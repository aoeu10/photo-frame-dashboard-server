import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { configJson } from '../fileModels/config.json'
import { initializeShoppingDefaults } from '../utils'

export const v_1_2_39_0 = VersionInfo.of({
  version: '1.2.39:0',
  releaseNotes: {
    en_US:
      '**Shopping starters on by default.** Prepopulated categories and items now default to on, even with an existing custom catalog. This upgrade enables the saved starter bank once without replacing edited or deleted rows. Users can turn Use prepopulated defaults off and submit Edit Shopping; that choice stays off across reloads and restarts.',
  },
  migrations: {
    up: async ({ effects }) => {
      await initializeShoppingDefaults(effects)
      // One-time opt-in for this upgrade, not a startup reset of user choices.
      await configJson.merge(effects, {
        shopping: { defaults: { enabled: true } },
      })
    },
    down: IMPOSSIBLE,
  },
})
