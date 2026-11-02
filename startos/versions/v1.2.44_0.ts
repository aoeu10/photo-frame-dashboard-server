import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v_1_2_44_0 = VersionInfo.of({
  version: '1.2.44:0',
  releaseNotes: {
    en_US:
      '**No demo fallbacks.** If the box cannot be reached, the dashboard shows a full-screen "Dashboard cannot be reached" message instead of the demo household. Weather without a location or forecast says Weather unavailable. The fake Home status is replaced by a Control4 coming-soon card, the prototype demo controls and fake alerts are removed, and the Agents section is gone.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
