import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.2.74:0',
  releaseNotes: {
    en_US:
      '**Sidebar order.** Photos now sits directly below Calendar in the rail, ahead of Meals and School.\n\n' +
      '**Album names in Edit Photos & Albums.** Each album row now shows the shared album name Apple reports from the last sync, with a read-only Album name field.\n\n' +
      '**School views.** The School section gains Today, 3 Day, Week and Month tabs, matching the Calendar section.\n\n' +
      '**User colours.** Edit Users now picks a colour from the same palette as Edit Calendars, and an existing custom hex colour is kept as a Current (#RRGGBB) option.\n\n' +
      "**School and meal calendars.** Edit Calendars now has School calendar and Meal calendar toggles. A calendar cannot be both, and choosing Meal turns off Show on Today homepage. The School section lists activities from school-marked calendars, and those events stay on the calendar's assigned personal page. Meals buckets a meal-marked calendar into Breakfast, Lunch and Dinner with Today, 3 Day and Week views. The separate Edit Meals and Edit School actions are removed.\n\n" +
      '**Vestaboard section.** Adds a Vestaboard rail view with a touch drawing grid and VBML preview for Flagship (6×22) and Note (3×15) boards. Configure the board address and Local API key in Actions & Config → Vestaboard Settings. The key stays on the server; only private-LAN boards are accepted. Hidden rail views no longer intercept taps.\n\n' +
      '**Settings order.** Actions & Config lists the settings in the order they are usually used: Sync Now, Edit Location & Units, Edit Calendars, Edit Users, Edit Photos & Albums, Photo Album Info, Edit Sidebar, Edit Groceries, Edit Chores, Printer Settings, Vestaboard Settings. StartOS orders actions by id, so the ids carry numeric prefixes. No configuration values change.\n\n' +
      '**Full lock is quieter.** The large Hold to unlock button is gone. While the screen is fully locked, one line at the very bottom reads **Screen locked** and says to hold the padlock to unlock; the floating padlock stays tappable above the shield and opens the passcode prompt when one is set. Everything else about locking is unchanged.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
