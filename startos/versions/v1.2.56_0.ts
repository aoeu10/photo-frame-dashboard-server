import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_56_0 = VersionInfo.of({
  version: '1.2.56:0',
  releaseNotes: {
    en_US:
      '**Corrected About links.** Source code and marketing now point to the private repository, while Upstream service points to wesbos/photo-frame-dashboard for compatible-frame setup.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
