import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_59_0 = VersionInfo.of({
  version: '1.2.59:0',
  releaseNotes: {
    en_US:
      '**Grocery continuation labels.** When a store list continues onto another page, the store name now repeats at the top of its column, so continued items keep their attribution. The label is not duplicated mid-column.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
