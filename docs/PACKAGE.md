<p align="center">
  <img src="icon.svg" alt="Frame Dashboard Logo" width="21%">
</p>

# Frame Dashboard on StartOS

> Everything not listed in this document should behave the same as the upstream
> dashboard. The served page is the `dashboard/` directory of
> [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)
> (commit `48b4ab0`), adapted here for StartOS data, screen locking and photo streaming.

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)

## Image and Container Runtime

- `main` is built from this repo's `Dockerfile`: a multi-stage build that
  compiles the vendored dashboard with Node 22 (`npm run build`, pinned to the
  builder's platform via `$BUILDPLATFORM`, since the output is
  architecture-independent static files) and serves `dist/` with
  `nginx:1.27-alpine`.
- Entrypoint: `python3 /opt/dashboard_service/start.py`, which starts nginx
  and the Python sync/API service in the same container.
- Architectures: `x86_64`, `aarch64` (matching `ARCHES` in the Makefile).
- The build stage never runs under emulation for any supported target.

## Volume and Data Layout

- `main` is mounted read-write at `/data` and holds everything the service
  owns: `config.json` (written by the config actions) and `frame_cache.json`
  (the last successful `/api/frame` document).

## Live Data

The image runs a Python service alongside nginx (one daemon; the entrypoint
starts both). On every sync cycle it fetches the METADATA of the configured
photo albums — public iCloud shared albums (rendition URLs, dates — like
iphoto-frame-saver) and Immich albums (asset IDs, dates) — parses the
configured ICS calendars, fetches the Open-Meteo forecast for the configured
location, and writes an aggregated `/api/frame` document that nginx proxies.
Nothing is copied to this box. The dashboard polls it every minute and
streams each iCloud photo straight from Apple's CDN; Immich images are served
by the box through `/api/immich/photo/<album>/<asset>?size=thumbnail|preview`
because the frame cannot send an API key. A successful response replaces the
photo list, including an empty list; empty albums show a message rather than
unrelated demo photos. Photo-list changes also discard the slideshow's old
queue and previous-photo history.
Configure albums, calendars, location and units through **Actions & Config**
(**Sync Now**, **Edit Location & Units**, **Edit Calendars**, **Edit Users**,
**Edit Photos & Albums**, **Photo Album Info**, **Edit Sidebar**,
**Edit Groceries**, **Edit Chores**, **Printer Settings**,
**Vestaboard Settings**; that is the order the actions appear in). StartOS keeps
actions in a `BTreeMap<ActionId, ActionMetadata>` and the Actions page sorts
them by id, so each action id carries a numeric prefix (`01-sync-now` …
`11-edit-vestaboard`); registration order in `actions/index.ts` is cosmetic. The service detects saved config changes within ten seconds
and starts a new sync; no restart is needed. Calendar links, shared-album
links and the Immich API key remain on the server; only photo rendition URLs
and relative Immich proxy paths reach the frame.

The API includes the resolved IANA `timezone`. The dashboard uses real time
and `@date-fns/tz` dates for clock display, event times, day boundaries and
calendar navigation, preserving absolute timestamps across daylight-saving
changes. It no longer resets to the demo's 3:18 PM at startup. Configure
the zone in **Edit Location & Units**; blank uses the container's `TZ` or UTC.

Each **Edit Calendars** entry has a dashboard/person name, a public ICS
link and a basic-color selection (red, orange, yellow, green, blue, purple,
pink or black). Apple `webcal://` links are normalized to HTTPS; published
links need not end in `.ics`. Successful syncs replace the entire demo
roster, including deleted calendars and an empty configuration. Calendar and
Today lanes resize to the configured roster; a lone calendar keeps its own
color rather than being classified as a family-wide event.

Month view lists real event titles instead of colored dots: up to two per day,
single-day events first, then multi-day ones, with `+N more` for the rest.
The grid uses whole Monday-first weeks (28, 35 or 42 days), so a short month
no longer leaves an empty sixth row. This month layout is adapted from
[wellavelino/frameo-homeassistant-dashboard](https://github.com/wellavelino/frameo-homeassistant-dashboard)
(MIT): its `chipOrder` ordering and `monthGrid` week count
(`Math.ceil((lead + days) / 7) * 7`) are ported into `monthView()` in
`js/views/calendar.js`; the dashboard is otherwise independent of that
project.

**Edit Photos & Albums** shows a read-only **Album name** per row, taken from
`frame_cache.json`'s `photoAlbums` entries. The cache emits iCloud albums first
then Immich albums, each with a `provider` field (`icloud` or `immich`), so the
form's two lists align with their own config arrays. Album names are
informational only and are not written back to `config.json`.

iCloud albums live in `config.albums` (`url`, `name`). Both modern
`photos.icloud.com/shared/album/<token>/` links and legacy
`www.icloud.com/sharedalbum/#<token>` links are supported, including
`icloud.com.cn`. Legacy image resources are requested in batches of 100
photo IDs.

Immich albums live in `config.immichAlbums` (`server`, `apiKey`, `albumId`,
`name`). The action accepts an album page link or bare UUID and stores the
UUID. `immich_source()` derives the server from a full album link when the
server field is blank, allowing either field order. Sync calls
`GET /api/albums/<id>?withoutAssets=false` with the `x-api-key` header. When a
newer Immich version omits the `assets` array, sync calls
`POST /api/search/metadata` with `filter.albumIds.all` and pages with
`nextCursor`. Older servers that reject that body with 400/422 are retried
with the deprecated top-level `albumIds` array and page numbers. Videos,
trashed assets and malformed IDs are skipped. The service accepts Immich API keys with
`album.read`, `asset.view` and `asset.read` (the last for album asset search
on newer Immich); the key stays in `config.json` and is never placed in
`frame_cache.json`. `immich_ssl_context()` disables certificate
verification only for `https` servers on `.local`, `localhost` or private IPv4
addresses, matching the IPPS printer precedent and covering self-signed
StartOS/UmbrelOS endpoints. Public hostnames keep normal verification.

Sync uses metadata only; no album images are stored on disk. The frame gets
relative proxy paths for Immich (`/api/immich/photo/...`) and Apple CDN URLs
for iCloud. The Immich proxy adds the API key server-side and returns
`thumbnail`/`preview` bytes with a one-day public cache; assets are immutable.
Only those sizes are accepted, so a frame cannot request originals.

Photo captions use the capture timestamp. iCloud uses `assetDate` with
`originalCreationDate` as the modern fallback and legacy `dateCreated`. Immich
uses `localDateTime` first because it preserves the photographer's local
calendar date, then EXIF `dateTimeOriginal`, then `fileCreatedAt` (both UTC).
The photo's timezone offset preserves its original calendar date when
available; UTC is used otherwise. `takenAt` and `date` are null when the provider does
not supply a valid capture date. Album-added time stays separate as `addedAt`
and is never substituted for capture time or today's date. Unknown dates
display **Date taken unavailable**; same-day anniversaries only apply to
earlier years, never “0 years ago today.”

**Photo Album Info** in Actions & Config displays album names and photo
counts in its description. Open it for each album's source (iCloud or Immich
server), provider title, configured dashboard label, photo count,
capture-date coverage/range, sync status and the last completed sync
timestamp. This is a read-only snapshot; reopen after Sync Now for fresh
information. Album failures appear in the snapshot without exposing private
shared-album URLs, Immich API keys or album tokens.

The photo controls are previous/next and layout selection. There is no
Favourite control or favourite-based repetition; every photo in the shared
album participates in the slideshow.

The previous/next buttons sit to the left of the floating lock with a
16-pixel gap at the frame's 1280×800 layout.

To diagnose photos, check `/api/frame`: `photos` contains the current
manifest and `generated_at` identifies the last completed sync. **Logs**
in StartOS shows album/API or sync failures. A stale timestamp means the
latest sync did not complete; it is not a frame cache issue. After a package
update, reload the kiosk once to load the updated JavaScript.

## Sidebar sections

**Edit Sidebar** in Actions & Config controls which sections appear in the
rail. The order is fixed—Today, Weather, Calendar, Photos, Meals, School, Chores,
Groceries, Vestaboard, Home controls—and Today cannot be hidden. Meals
and School are opt-in: they default to hidden when `nav` is absent or does not
mention them, while every other section defaults to visible. Each section has
its own show/hide toggle directly on the form. Hidden sections stay valid
routes: direct section links still work, and their Today cards go blank instead
of showing content or opening the hidden section. `/api/frame` publishes the
normalized `nav` list, and the dashboard applies it without rebuilding the rail
on every poll.

## Meals and school

Two opt-in sections driven by flags on **Edit Calendars** rows. A calendar can
be normal, `school` or `meal`; Edit Calendars rejects a row that is both, and a
meal calendar always saves with `showOnHome` false.

`config.calendars[].meal` marks a calendar as the meal calendar. Its events are
fetched by `sync_calendars` like any other calendar, so they keep their `cal<N>`
key in `doc.events` and still appear in the Calendar tab. `build_meals` filters
that event list to meal-calendar keys, keeps today plus six days, and buckets
each non-all-day occurrence by local start hour: 7–8 → `breakfast`, 11–12 →
`lunch`, 17–18 → `dinner`. `/api/frame` publishes `meals {status, name, keys,
calendars, items:[{date, slot, title}]}`; `status` is `off` with no meal
calendar, `unavailable` when every meal calendar failed to fetch, otherwise
`ok`. `views/meals.js` renders Today (three headings), 3 Day and Week (today
plus six days) from the same tabs the Calendar section uses, showing only names
without times.

`config.calendars[].school` marks a calendar as a school calendar. `build_school`
publishes `school {keys, calendars[{key, name, color, status}]}` from those
calendars and their fetched metadata; no separate ICS link or user list is
stored. The School section renders `D.events` for those keys with Today, 3 Day, Week
and Month tabs, mirroring the Calendar section. School calendars are ordinary `cal<N>` people entries, so their
events also appear on the personal page of their assigned user (or wherever
Edit Users selects them), in the calendar's own color, and keep their lane in
the Calendar tab and Today where `showOnHome` is on.

## Vestaboard

**Vestaboard Settings** stores `vestaboard.host`, `vestaboard.apiKey` and
`vestaboard.board` in `config.json`. The board address must be a private IPv4
address or a `.local` hostname; port 7000 is fixed. The service resolves the
host, verifies that every resolved address is private IPv4, and then calls
`http://<address>:7000/local-api/message` with the
`X-Vestaboard-Local-Api-Key` header. The key is never included in
`/api/frame` or `/api/vestaboard` responses and is never sent to the frame.

`/api/vestaboard` returns the configured board size, reachability, the current
message matrix and a sanitized error. `/api/vestaboard/compose` composes VBML
without sending, and `/api/vestaboard/message` accepts either a `characters`
matrix or a `vbml` payload. The service implements a practical VBML subset:
props, templates, `{n}` character codes, multiple components, component
height/width, left/center/right/justified horizontal alignment, top/middle/
bottom/justified vertical alignment, `absolutePosition`, and `rawCharacters`.
The board's current message is validated against the configured 6×22 or 3×15
shape before it is shown.

## Chores

**Edit Chores** in Actions & Config holds the chore roster. Each row has a
title, optional emoji (blank becomes ✅), a routine (Morning, Mid-Day or
Evening), a star value clamped to 0–10, and an **Assigned to** select built
from **Edit Users** plus **Anyone**. Rows display `emoji title` collapsed.
Saving derives stable ids from routine and title, so completion marks survive
polls while the roster is unchanged.

The Python service `build_chores` resolves an assigned user name
case-insensitively to that user's stable id and publishes the roster as
`chores` (`id`, `r`, `who`, `title`, `emoji`, `stars`). Blank or unknown
assignees become `who: any`; unknown routines fall back to Morning. `server.js`
merges the roster into `D.chores`, carrying over in-session completion marks by
id and clearing demo star/week data when the roster changes. `App.choreLanes`
uses configured users plus Anyone; `tasks.js`, Today's rings (`home.js`) and
the personal-page chore card (`user.js`) filter by those ids. Completion is
client-side and resets on reload.

Installation and the 1.2.41 upgrade migration seed the example chores once via
`initializeChores`. An absent `chores` key is seeded; a saved empty list or
edited roster is authoritative and is never reseeded.

## Groceries and printing

The Shopping config key and action id remain for compatibility, but every
user-facing label is **Groceries**. **Edit Groceries** holds the catalog and
stores; the frame list is unchanged. The Groceries sidebar has **Print**
and **Clear all**. Clear all empties every store's list after confirmation and
posts the empty list through `/api/shopping/list`.

Print sends `POST /api/print` with body `{}`. The service reads only
`config.json`'s saved `printer: {name,url}`, generates a grouped PDF with
`service/grocery_print.py`, and sends an IPP Print-Job. Store sections print
side by side in columns, quantities stay beside their item, and long lists
paginate within the columns. A store whose column continues onto another page
repeats its name at the top of that page. A request URL cannot
override the saved printer. The browser does not call `window.print()`,
perform discovery, display printer URLs, or offer printer configuration.
The button is disabled while sending and reports success or failure.

**Printer Settings** is the only printer action. Opening it runs a fresh scan
before building the form. One result prefills name/URL only when no URL is
saved; multiple results require an explicit choice. A failed or empty scan
still opens the manual fields with setup guidance. An existing saved printer
is never overwritten on open. Submit saves either the explicit discovered
selection (reported name and URL) or the manual fields, including clearing.
The select's persistent `footnote` reports fresh found URLs, no results or
failure, and whether the saved URL was returned by that search. Do not put
this status only in `description`, which the UI presents as tooltip help.
The manual choice uses the non-empty `manual` value for both initial values
and the field default: StartOS applies Angular `Validators.required` to every
select and also renders empty-string selections as blank. The save handler
must not parse the manual choice as a discovered-printer JSON value.
The SDK spec/initial-value callbacks share one search within the request;
results are not persisted or reused across openings. The old separate
`discover-printers` action is removed by the SDK's action-registration cleanup.
`discover_printers` combines `_ipp._tcp`/`_ipps._tcp` advertisements with
unicast IPP queries. Printer Settings and `GET /api/printers` use
`192.168.1.0/24` for missing, empty or whitespace-only `printer.scanSubnet`;
explicit custom subnets override it and remain intact across upgrades.
Clearing and saving the field restores that default without changing the
saved printer URL. The config file model supplies the same default for
missing fields. These entrypoints do not infer a range from container routes.
The Python library still supports automatic directly connected route detection
when explicitly called without `subnets`. `_private_subnet` rejects public,
IPv6 and ranges larger than 1024 addresses.

The scan uses 48 workers, 0.3-second TCP probes to ports 631/443 and bounded
IPP Get-Printer-Attributes queries (no print jobs). It checks `/ipp/print`,
`/ipp/printer`, `/printers` and `/`, including self-signed IPPS on 443/631.
Only successful complete IPP responses with printer state, Print-Job and PDF
support qualify; HTML/admin servers, malformed responses and unsupported
devices are excluded. UUIDs deduplicate Bonjour/subnet and IPP/IPPS results.
The probing budget is 25 seconds; the action subprocess timeout is 45 seconds.
The API caches results by subnet scope for 30 seconds; the action forces a
fresh scan. Missing Bonjour support does not disable subnet discovery.

Manual URL entry and README setup links remain for unusual queues, ports,
authentication or inaccessible networks. `ipps://` uses an unverified LAN TLS
context for printers with self-signed certificates; CUPS is not required.

Printer Settings links to the README's
[Find your printer's IPP URL](../README.md#find-your-printers-ipp-url) guide.
Action links derive their repository URL from `manifest.packageRepo`; keep
that URL correct when publishing or moving the repository. Printer Settings
retains its editable URL field and save handler. Manual setup is not hardcoded
to a household's IP, and dashboard printing still cannot override it.

The service publishes `printer` config only to the local API; printer URLs stay
on the box. The frame sends a print request over its existing LAN connection.
Printing requires a printer that accepts PDF (`application/pdf`) over IPP.

## Users

The upper-right block on Today lists the users configured through **Edit
Users** in Actions & Config; each entry opens that person's personal home page.
The action shows an add/remove list. Each row has a name, a colour chosen from
the same palette as Edit Calendars (a saved custom hex colour is kept as a
**Current (#RRGGBB)** option so reopening the form cannot rewrite it), a
multi-select of calendars for that person's page, the cards for that page, and
a read-only **Calendar activity** line taken from the last completed sync. The
collapsed row displays `Name · next activity`, so calendar state is visible
without opening every row.

Each **Edit Calendars** row also has an **Assigned user** selector, a
**Show on Today homepage** toggle, a **School calendar** toggle, and a
**Meal calendar** toggle. A calendar assigned to a user is selected by
default on that user's personal page; the multi-select in Edit Users overrides
it once saved. Calendars switched off still appear in the Calendar tab, but
their events and person lane are removed from Today. Calendar rows display
`Name · user` (plus `hidden from Today`) without opening the row.

The personal calendar card shows a one-line summary such as
`3 events left today · next at 3:00 PM`, followed by that person's agenda.
In-progress events are marked **Now** in the agenda. When nothing remains, the
card says **Free the rest of the day**. A user with no calendars selected sees
**No calendar selected** and no events; an empty selection never means every
calendar. There is no duplicate **Next up** hero
on personal pages; Today owns the household-wide next-event panel.

Cards are chosen from `calendar`, `weather`, `photos`, `chores`, `shopping`
(Groceries) and `home`, defaulting to `calendar, weather, photos`. Unknown cards are ignored.
A user's page lists events from their selected calendars plus the cards they
chose. Removing a user removes their page and returns the frame to Today if
that page was open. Without configured users, the corner falls back to
calendar status. Activity comes from `frame_cache.json` (`calendars` and
`events`), so run **Sync Now** and reopen the action for fresh text.

StartOS actions are package-wide, so every user is edited from the same
**Edit Users** action rather than separate per-user settings pages.

## Frame resilience

This hardware has no clock battery: every boot can start years off until the
network sets the time, and a loaded page can jump years. The dashboard treats
any year before 2025 (or more than 50 years ahead) as untrusted: the sidebar,
Today and ambient views read `--:--` / **Waiting for network time**, and the
calendar header stops labelling a day "Today" until the clock is plausible.
The check runs every second and re-renders everything date-based the moment
real time arrives.

When `/api/frame` fails, a full-screen **Dashboard cannot be reached** message
replaces the dashboard instead of showing demo data; it clears on the next
successful poll. Calendar titles drop emoji the frame's Android 6 font cannot
draw (flags, ZWJ sequences, skin tones) while keeping ordinary text symbols.
Weather is published only when Open-Meteo returns real data; otherwise
`server.js` clears `D.weather` and Weather, Today and ambient say
**Weather unavailable**.

The page also reloads itself once daily during a 03:00–06:00 window, because
it runs for weeks in one WebView. By that hour the frame is normally in its
dim night view, so the reload records the current mode and restores it on boot
rather than lighting the dashboard. It never reloads while a section is locked,
and the day stamp is persisted so a reboot cannot loop. The night/ambient
choice also requires a plausible clock, so a wrong boot time cannot dim the
display at midday. Titles made only of emoji keep their original text rather
than rendering blank. These behaviors are adapted from
[wellavelino/frameo-homeassistant-dashboard](https://github.com/wellavelino/frameo-homeassistant-dashboard)
(MIT): `clockTrusted` and `cleanTitle`.

## Night display

After two idle minutes at night the frame dims the dashboard rather than
replacing it: the rail, the current section and photos stay on screen under a
62 % black overlay at reduced brightness, so text and pictures remain readable.
The first touch only wakes the screen and is not passed to the page, so it
cannot toggle a control by accident.

**Edit Location & Units** exposes two settings. *Dim the screen at night* is on
by default; turning it off restores the older behaviour where idle at night
switches to the ambient photo view, and takes effect on the next refresh rather
than at the next touch. *Red night colours* tints the dimmed screen red
(`sepia`/`hue-rotate` on the rail and views, plus a dark-red overlay) to remove
blue light before sleep; it has no effect while the screen is awake. Both values
are published as `night: {dim, red}` in `/api/frame`.

Because the dashboard now stays lit for hours, the dimmed view shifts its
content by a few pixels each minute, as the ambient photo view already did, so
nothing burns into the panel.

## Screen lock

`js/lock.js` and `css/lock.css` implement the lock. Holding the floating
padlock (`#railLock`, bottom-right, above the rail) for 1.2 s opens the options
sheet while unlocked: *Lock to &lt;section&gt;* keeps the current section with
its controls usable, *Lock Entirely* adds a touch-blocking shield, and the
passcode rows store a SHA-256 hash in `localStorage` (`hq.lock.v1`).

Full lock renders one line at the very bottom of the screen — a lock icon,
**Screen locked**, and *Hold the padlock to unlock* — with no button. The
floating padlock is raised above the shield (z-index 46 over 45) so it stays
reachable; holding it calls `requestUnlock()`, which asks for the passcode when
one is set. The shield sits below sheets (z-50), so the keypad and options
remain on top. Lock state survives reboots, idle dimming is paused, and the
daily self-heal reload skips a locked section.

## Weather and radar

The **Weather** tab in the rail (or tapping the weather card on Today) shows the
full forecast: current conditions with feels-like, humidity, wind, gusts and
pressure, the next 12 hours, and seven days with rain chance and sunrise/sunset.
Forecasts and current conditions come from [Open-Meteo](https://open-meteo.com/)
through `/api/frame`; the full-page hourly strip uses `weather.next`.
The current condition icon uses the API's `current.weathercode`, not the
hour-of-day slot. The 24-slot arrays contain today's local forecast only;
later forecast days no longer overwrite the same hour. The forward `next`
strip still crosses midnight into the following days.
The header identifies the forecast city/state and ZIP. The service looks up
the postal place through Zippopotam during weather sync, including for ZIPs
saved before this feature. This name is separate from a configured label such
as "Home". Coordinate-only locations, or a failed postal lookup, display that
label and the actual coordinates instead of guessing a city. A postal lookup
failure does not discard the weather forecast or change the coordinates.

**Radar is not from Open-Meteo** — that service is forecast-only and publishes no
radar imagery. The radar loop comes from [RainViewer](https://www.rainviewer.com/),
whose free public API covers personal use, needs no key, and asks for visible
attribution; the panel shows a **RainViewer** credit. `GET /api/radar` on the box
fetches and caches the frame list (last two hours, ~13 frames, refreshed every
four minutes). Tile images are also proxied through the box at
`/api/radar/tile/<frame>/<z>/<x>/<y>`; the frame does not contact RainViewer.

The location can be set as a 5-digit US ZIP code (resolved on the box via
Zippopotam, which returns the ZIP's own centroid rather than the parent city's
centre) or as latitude/longitude; a ZIP wins when both are present.

The panel renders a 3×3 block of z=7 tiles positioned so the configured point
lands at the panel centre (Web Mercator tile math). The map appears immediately,
with **Loading radar N%** while every tile in the full replay loads and decodes.
Only then does playback start, advancing every 550 ms with a timestamp and
progress bar. Decoded images stay referenced between visits. Returning to a
fully buffered replay with fresh metadata resumes immediately without loading
or decoding the tiles again, including after a map zoom change. New, expired,
failed or interrupted replays still pass the full buffering gate; leaving the
tab cancels that load's playback start.
The geographic background uses labeled OpenStreetMap raster tiles, with a
transparent U.S. Census Bureau state/county layer so county outlines are visible
even at the regional scale. Provider credits remain visible on the map.
The **− / +** buttons change map zoom from 7 through 10. RainViewer source tiles
stop at zoom 7, so closer views enlarge those same radar pixels rather than
inventing finer precipitation detail. Both layers share the same Web Mercator
coordinates and location centre.

`/api/basemap/<z>/<x>/<y>` and `/api/boundaries/<z>/<x>/<y>` proxy geographic
tiles through the box. Only tiles intersecting the displayed viewport are
requested: there is no geographic prefetch or offline download feature.
The box identifies itself to OSM and preserves the browser's Referer. PNGs
and revalidation metadata persist in `/data/basemap_tiles` for at least seven
days; expired entries use conditional HTTP requests. The browser also caches
them. nginx preserves the API's individual cache policies: JSON is `no-cache`,
radar tiles are cached for ten minutes and geographic tiles for at least seven
days. `BASEMAP_TILE_URL` can replace the OSM URL template at container startup.
See the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

The box probes the location's **centre tile** at every replay timestamp. Only
when every probe succeeds and has fewer than 200 non-transparent pixels does
the panel say **Local tile: no significant echoes**. This is not a claim about
rain elsewhere in the panel, rain at ground level, or the forecast. Unknown
probes and closer map zooms suppress the notice. Metadata is cached independently of location;
echo results are cached by immutable frame token and tile coordinates.
Pillow runs on the box using Alpine's native package, not on the Android frame.
If any replay tile fails to load or decode, the panel says **Radar unavailable**
instead of animating missing tiles; the map and forecast remain visible.

## File Models

- `config.json` on `main`: album links, calendar links and colors, location,
  timezone, temperature unit, sync interval, night display settings, the
  sidebar order/visibility (`nav`), the configured people (`users`), the
  chore roster (`chores`), shopping settings and the optional default printer
  (`printer`). Actions merge these values without replacing unrelated settings.
- `sync.now.json` on `main`: a one-shot request written by **Sync Now** and
  consumed by the service.
- `frame_cache.json` on `main`: a read-only projection of `generated_at` and
  `photoAlbums` for the album-information action. The Python service owns
  and atomically replaces the full snapshot; actions never write it.
- StartOS's per-address settings (LAN/`.local`, public domains, SSL and auth
  gates) are separate and managed in **Interfaces**.

Python dependencies include `icalendar`, `recurring-ical-events` and
`zeroconf` (mDNS printer discovery). No CUPS daemon is required.

## Dependencies

None.
