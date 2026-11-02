import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_55_0 = VersionInfo.of({
  version: '1.2.55:0',
  releaseNotes: {
    en_US:
      '**Private repository and updated About links.** The StartOS About source and marketing links now point to this private repository. README credits Wes Bos for the dashboard foundation and directs compatible-frame setup to the upstream project, including the submitted Dragon Touch Classic10 Charm guide.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
