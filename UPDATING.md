# Upstream tracking

This package does not track a released upstream image. The dashboard source is
**vendored** at `upstream-project/`, copied from:

- Repo: <https://github.com/wesbos/photo-frame-dashboard>
- Directory: `dashboard/` (the Android `kiosk/` subdirectory is excluded — it
  ships separately and is not served)
- Commit: `48b4ab0` (last commit touching `dashboard/` at vendoring time,
  2026-10-17)

The upstream repository carries no LICENSE file; the package's MIT license
covers the packaging only. The vendored page keeps its upstream attribution.

## Local additions on top of the pin (a refresh must re-apply these)

- `js/lock.js`, `css/lock.css` — screen lock (new files).
- `js/main.js` — lock and live-server imports.
- `js/app.js` — lock/idle gates, real-time startup, IANA-zone date factory
  backed by `@date-fns/tz`, roster-aware event colors, boot-clock trust guard,
  emoji-safe titles and the guarded nightly reload.
- `package.json` / `package-lock.json` — pinned `@date-fns/tz` dependency.
- `js/server.js` — live data merge, resolved time zone, authoritative calendar
  roster, removal of demo people and the full-screen outage overlay.
  Emoji-safe event text is adapted from
  wellavelino/frameo-homeassistant-dashboard (`cleanTitle`, MIT).
- `js/views/home.js`, `js/views/ambient.js`, `js/views/calendar.js` — clock
  trust guard renders `--:--` / "Waiting for network time" instead of an
  implausible boot date.
- `js/views/calendar.js`, `js/views/home.js`, `js/views/tasks.js`,
  `js/views/ambient.js` — configured names, calendar headers, zoned dates.
  The ambient photo screensaver intentionally omits the calendar-colored
  people-avatar row; do not restore `.amb-who` or its avatar markup.
- `css/views/calendar.css`, `css/views/home.css`, `css/views/tasks.css` —
  roster-sized layouts.
- `js/slideshow.js` / `js/views/photos.js` — Apple CDN photo sources, capture
  dates, empty-album handling and removal of Favourite weighting/controls.
- `css/views/photos.css` — photo navigation spacing beside the lock.
- `js/views/calendar.js` month grid + `css/views/calendar.css` month styles —
  titled month cells adapted from
  [wellavelino/frameo-homeassistant-dashboard](https://github.com/wellavelino/frameo-homeassistant-dashboard)
  (`page/calendar.js`, MIT): `chipOrder` (single-day first, multi-day last) and
  `monthGrid`'s `Math.ceil((lead + days) / 7) * 7` week count. Upstream refresh
  must preserve this layout.
- `js/views/weather.js`, `css/views/weather.css` — Weather tab, proxied replay,
  centre-tile clear notice (all timestamps must be known-false), OSM labeled
  basemap, Census state/county overlay, and zoom 7–10 with aligned source-z7
  radar overzoom. Playback waits for every replay tile to load and decode;
  retained Image references keep decoded tiles alive. Preserve the generation
  guard so an obsolete preload cannot start playback after navigation.
  Geographic tiles load only for the current viewport.
  The header shows `weather.loc.city` plus ZIP, with configured label/coordinate
  fallback. Keep the city separate from the date `.label` updated each minute.
  `service/dashboard_service.py` separates radar metadata/echo caches and keeps
  geographic PNGs plus HTTP revalidation metadata in a persistent seven-day
  cache. Preserve provider attribution, identifying User-Agent and Referer.
  Weather sync resolves the ZIP's postal city/state through Zippopotam and
  publishes `weather.loc.{name,city,zip}` alongside the original coordinates.
  Lookup failure must retain the Open-Meteo forecast and must not guess a city.
  Hourly `t/c/p/mm` arrays are today's local day only. Do not key the 168-hour
  forecast by hour-of-day: later days overwrite today. `now.c` is the current
  weather code; the Today card and Weather condition icon must use it, while
  `next` remains the timestamp-filtered forward strip across midnight.
  The Dockerfile supplies native Alpine `py3-pillow`.
- `nginx.conf` — `/api/` preserves the service's per-response Cache-Control.
  Do not append blanket `no-cache`: it overrides radar/map tile caching.
- `index.html` — `css/lock.css` link, the `#railLock` button and the
  `#offline` overlay (initially "Connecting to the dashboard…").
- Offline and demo removal: `server.js` shows `#offline` on any failed
  `/api/frame` poll and hides it on success; it no longer keeps demo data
  visible or uses the stale banner. `data.js` has no demo weather, busy-event
  mode, or Agents data; `D.weather` stays `null` until the server supplies
  real weather. `app.js` has no demo clock offset, calendar modes, or demo
  tip. `system.js` now only provides `App.img`; the demo drawer, fake
  alerts/takeovers/banners and their keyboard shortcuts are gone. Home status
  on Today and personal pages says Control4 is coming soon instead of reading
  demo devices/climate. Weather cards, the Weather tab and ambient mode show
  unavailable when `App.hasWeather()` is false. `service/dashboard_service.py`
  `NAV_SECTIONS` and `startos/actions/editSidebar.ts` no longer include
  `agents`; `js/views/agents.js` and its CSS are deleted. Keep nav constants
  and tests aligned when removing a section.
- `js/app.js` — `App.setNav` applies the server `nav` list to `#rail` in
  order, sets `hidden` per section, and keeps Today first. `server.js` merges
  `frame.nav` and re-applies only when it changes. Hidden sections remain
  valid routes: Today cards and the section lock still open them.
  `service/dashboard_service.py` `build_nav` owns normalization (Today
  pinned/visible, unknown/duplicate keys dropped, omitted keys hidden,
  absent setting = built-in order).
  `startos/actions/editSidebar.ts` renders one visibility toggle per section
  (`show_<key>`) in the fixed built-in order. StartOS forms render only fields
  and have no button, arrow, or drag input type, so there is deliberately no
  ordering control. Keep the service normalizer equivalent.
  `js/views/calendar.js` listens for `data` and repaints when it is the current
  view; this is required for direct `#calendar` loads and outage recovery,
  because the other views already repaint themselves.
  `js/views/home.js` must mirror rail visibility: `App.sectionVisible` gates
  the weather, photo, chores, shopping and Home-control cards, and the
  calendar-driven clock shortcut, hero and lanes. Hidden cards are emptied and
  hidden (CSS `[hidden]`), and the photo slideshow is stopped while hidden.
  Do not leave hidden content or `data-go` shortcuts on Today.
- `js/views/user.js` — personal home pages. `App.syncUsers` registers a
  `user-<id>` view and a `#view-user-<id>` section per configured user, and
  removes both when a user disappears. Leave a removed user's page before
  deleting its view; `App.go` guards against a missing current view. Presence
  entries use `data-user`, and the page's back button uses `data-go="home"`.
  The personal calendar card uses a one-line summary
  (`N events left today · next at …`, `in progress`, or `all day`) and keeps
  the agenda below it; do not restore the old **Next up** hero. With no events,
  show **Free the rest of the day**.
  `startos/actions/editUsers.ts` builds the add/remove user list with a
  dynamic multi-select of calendars and `displayAs` showing `Name · activity`.
  `startos/actions/userActivity.ts` resolves selected calendars and the next
  event from `frame_cache.json`; keep it aligned with `build_users` in the
  Python service. The frame cache now projects `calendars` and `events` for
  that label.
  `startos/actions/editCalendars.ts` adds `Assigned user` (dynamic from Edit
  Users) and `Show on Today homepage`, with `displayAs` showing the name
  collapsed. The service publishes calendar `user`/`home`; `server.js` derives
  `D.homePeople`, and Today lanes use only those. The Calendar tab still uses
  all of `D.people`. Personal pages filter by `user.calendarKeys`; an empty
  selection means no calendars, not every calendar. Show **No calendar
  selected** and the free-time empty state instead of borrowing another
  person's events. `App.nextEvent()` treats an omitted key list as every
  calendar but an empty array as none; do not collapse those cases. Today's
  hero and Tomorrow fallback must also return nothing when `homePeople` is
  empty.
- `js/views/tasks.js`, `js/views/home.js`, `js/views/user.js`, `js/app.js` —
  chore roster from StartOS. `App.choreLanes` uses configured users plus
  Anyone (demo people only when `D.users` is not an array). `App.person`
  resolves configured users too. `server.js` merges `frame.chores` and keeps
  in-session `done`/`doneBy` by chore id; a changed roster clears demo
  `D.stars`/`D.week`. Completion is not persisted. `user.js` filters the
  personal chore card by `u.id`; `home.js` rings and `tasks.js` lanes use
  `App.choreLanes`. Anyone completion asks configured users who did it; with
  no users it completes directly. `tasks.js` and `user.js` listen for `data`
  and repaint the visible Chores view or personal page, so a poll that changes
  the roster or users is reflected without navigating away. `user.js` stops a
  running photo slideshow before re-rendering a personal page.
  The 11 AM–5 PM routine keeps id `after` and is labelled **Mid-Day** in both
  `data.js` routines and `CHORE_ROUTINES` in `editChores.ts`; keep those labels
  aligned when renaming a routine. Saved chores remain in `after` with no
  migration.
  `startos/actions/editChores.ts` owns the add/remove rows: title, optional
  emoji, routine select, dynamic user-or-Anyone select and 0–10 stars. It
  derives stable ids from routine plus title; keep the id algorithm aligned
  with `build_chores` in the Python service. `service/dashboard_service.py`
  publishes `chores` (`id`,`r`,`who`,`title`,`emoji`,`stars`), resolving user
  names case-insensitively and falling back to Anyone for blank/unknown users.
  `initializeChores` in `utils.ts` seeds the example bank from
  `actions/choreExamples.ts` only when `chores` is absent; a saved empty list
  is authoritative. It runs on install and in the 1.2.41 migration; retain
  that real migration as a historical version on the next bump.
- `js/views/shopping.js` — catalog-driven list. Tapping a tile adds an item or
  raises its quantity; the × button removes it. No "got it" checkbox. The list
  is posted to `/api/shopping/list` (debounced) and reloaded from
  `frame.shopping`, so it survives reloads. `server.js` maps the server
  catalog into `D.groceries`, `D.catalog`, `D.usuals`, `D.stores` and
  `D.catOrder`; stores use their name as the id. Repaint on `data` while
  visible so a late first poll still fills the list.
  Active store defaults to `''` (Unspecified); `null` means the All view and
  uses `data-all`, not a reserved store-name string. `targetStore()` maps All
  additions/checkmarks to Unspecified. Item identity is case-insensitive name
  plus destination store. All rows include store labels. Unspecified rows have
  an assignment select; moving to an existing name/store combines quantities
  and retains notes. Quantity/removal still target row ids. Store switches
  repaint both list and catalog.
  Persist every store's rows together, not only the active tab's rows.
  `css/views/shopping.css` keeps the custom-entry input 48px tall with 8px
  outer padding (64px overall), 22px text and a matching 22px plus icon.
  All user-facing labels say **Groceries**; the config key and action id stay
  `shopping` for compatibility. The sidebar has **Print** and **Clear all**.
  Clear all confirms, empties `D.groceries`, and posts the empty list.
  Print posts `{}` to `/api/print`; only the server's saved `printer {name,url}`
  setting selects the destination. No dashboard URL override, discovery sheet,
  `#printRoot`, browser print call or print-only stylesheet remains.
  `service/grocery_print.py` builds the PDF and sends IPP Print-Job directly.
  Keep store sections in side-by-side columns (up to three) and render each
  quantity beside its item; do not move quantities back to the right margin.
  Long lists must paginate within the columns without crossing the content
  area or footer. When a store column continues onto another page, repeat its
  store label at the top of that page exactly once; do not duplicate it later
  in the column.
  Printer Settings is the only printer action and scans automatically on open.
  One result prefills an unset printer; multiple results require a choice.
  Preserve an existing saved name/URL on open. A failed or empty scan must
  still open editable manual fields. Only Submit saves a discovered selection
  or edited/cleared manual URL. Share one scan between spec and initial-value
  construction; do not persist stale results. Changing Scan subnet takes
  effect when settings are saved and reopened. Do not restore the separate
  Discover Printers action; SDK registration cleanup removes its old entry.
  Keep fresh scan status and found URLs in the select's visible `footnote`,
  not only tooltip `description`. Distinguish rediscovery from loading a
  saved URL. The manual choice/default must use a non-empty value: StartOS
  marks every select required and renders empty-string choices as blank.
  Manual selection must permit save/edit/clear even after empty/failed scans.
  `discover_printers` combines Bonjour candidates with bounded private IPv4
  subnet probes (ports 631/443) and IPP Get-Printer-Attributes verification.
  Printer Settings and the discovery API default missing/blank/whitespace
  `printer.scanSubnet` to `192.168.1.0/24`, not container-route detection.
  Preserve trimmed non-empty custom scopes. Saving a cleared field restores
  the default; leave the saved printer name/URL unchanged when only the scope
  changes. Keep the config model, action default and Python API fallback in
  sync. Never scan public networks, `0.0.0.0/0` or silently truncate oversized
  ranges. The cap is 1024 addresses, 48 workers and a 25-second probing budget
  (45-second action exec timeout).
  Only complete successful IPP responses supporting PDF and Print-Job qualify.
  No discovery request may submit a print job. UUIDs merge duplicate endpoints.
  `ipps://` uses an unverified LAN TLS context; manual URL entry stays supported.
  Printer Settings links to the README `#find-your-printers-ipp-url` guide.
  The repository portion comes from `manifest.packageRepo`; update it if the
  public repository moves. Preserve manual URL entry in StartOS, including
  save/reopen/change/clear behavior. The guide documents the Mac DNS-SD
  service → hostname/port/rp → IPv4 lookup, plus printer/router alternatives.
  `service/dashboard_service.py` `build_shopping` owns normalization and
  `POST /api/shopping/list` merges the list into `config.json` without touching
  the catalog. `startos/actions/editShopping.ts` provides store rows and
  category rows with nested item rows (name, optional store dropdown, usual
  toggle). `shoppingCatalog.ts` converts between those rows and the existing
  flat stored catalog. Store choices load when the action opens: save and
  reopen to use newly added stores. Never
  include `shopping.list` in the editor write; the frame owns that list.
  `shopping.defaults {enabled, categories, items}` holds the separate editable
  starter bank. `initializeShoppingDefaults` in `utils.ts` persists an absent
  bank from the shared template, on by default regardless of custom items.
  It runs on fresh install; historical 1.2.38 retains the first upgrade seed.
  Historical 1.2.39 enables the saved bank once without replacing its rows.
  Subsequent initialization and editor opens honor saved false choices.
  1.2.40 is a no-op historical node; 1.2.41 seeds example chores once.
  Keep every real migration registered as a historical file and retain them
  on future version bumps without copying their bodies.
  Saved empty starter arrays remain authoritative: never reseed deleted rows.
  The service combines enabled
  starters with the custom catalog, giving custom item names case-insensitive
  precedence. Disabled starters remain stored and do not appear in the catalog;
  their categories remain available for entries already on the current list.
- `js/views/control.js` — `CONTROL4_READY` flag + placeholder branch;
  `css/views/control.css` — `.hc-ph` placeholder styles.
- `UPDATING.md` itself and the package Dockerfile/nginx.conf are packaging,
  not dashboard, files.

## Why vendored instead of a submodule

The long-term plan is to fork the dashboard for this household (Control4
integration, Apple calendars/reminders/photos, screen lock), at which point
`upstream-project/` should become a git submodule pointing at that fork.
Until then, the vendored snapshot keeps the upstream pin and household-specific
changes together.

## Refreshing

```sh
rsync -a --exclude kiosk --exclude node_modules --exclude .wrangler \
  <photo-frame-dashboard-clone>/dashboard/ upstream-project/
```

Then bump `startos/versions/current.ts` and note the new upstream commit here.
