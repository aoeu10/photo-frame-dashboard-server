# Changelog

Package versions follow StartOS's `<version>:<revision>` format. Each versioned
entry is the release note shipped with that package version.

## 1.2.74 — 2026-11-01

**Sidebar order.** Photos now sits directly below Calendar in the rail, ahead of Meals and School.

**Album names in Edit Photos & Albums.** Each album row now shows the shared album name Apple reports from the last sync, with a read-only Album name field.

**School views.** The School section gains Today, 3 Day, Week and Month tabs, matching the Calendar section.

**User colours.** Edit Users now picks a colour from the same palette as Edit Calendars, and an existing custom hex colour is kept as a Current (#RRGGBB) option.

**School and meal calendars.** Edit Calendars now has School calendar and Meal calendar toggles. A calendar cannot be both, and choosing Meal turns off Show on Today homepage. The School section lists activities from school-marked calendars, and those events stay on the calendar's assigned personal page. Meals buckets a meal-marked calendar into Breakfast, Lunch and Dinner with Today, 3 Day and Week views. The separate Edit Meals and Edit School actions are removed.

**Vestaboard section.** Adds a Vestaboard rail view with a touch drawing grid and VBML preview for Flagship (6×22) and Note (3×15) boards. Configure the board address and Local API key in Actions & Config → Vestaboard Settings. The key stays on the server; only private-LAN boards are accepted. Hidden rail views no longer intercept taps.

**Settings order.** Actions & Config lists the settings in the order they are usually used: Sync Now, Edit Location & Units, Edit Calendars, Edit Users, Edit Photos & Albums, Photo Album Info, Edit Sidebar, Edit Groceries, Edit Chores, Printer Settings, Vestaboard Settings. StartOS orders actions by id, so the ids carry numeric prefixes. No configuration values change.

**Full lock is quieter.** The large Hold to unlock button is gone. While the screen is fully locked, one line at the very bottom reads **Screen locked** and says to hold the padlock to unlock; the floating padlock stays tappable above the shield and opens the passcode prompt when one is set. Everything else about locking is unchanged.

## Unreleased — documentation

Added 23 privacy-safe dashboard screenshots to the README, with a reusable
fictional Boise family fixture, credited local forest/mountain photo assets and
an isolated capture workflow. Includes four calendar views, partially completed
chores, two grocery stores, Dad's personal page, photo layouts, the screensaver,
red-light night mode and screen-lock states. No application behavior changed.

Added regional and closer Seattle-area radar screenshots showing real
precipitation over the labelled map and boundary overlays. Included a reusable
Seattle location preset and weather-only capture mode, preserving the Boise
gallery and all live settings.

Added a top-of-README frame setup guide linking Wes Bos's model-specific
instructions, with StartOS installation, actual LAN IP/port selection, a
copyable agent prompt and the distinction between a saved kiosk URL and
optional offline LAN recovery. Updated the packaged setup instructions to
use the actual exposed port and explicit ADB target. Documentation only;
no application behavior or package version changed.

Sanitized documentation, example data, screenshot device/network fields and
copyright attribution for public sharing. Published a fresh repository with
one privacy-clean source commit and a sanitized release download; application
behavior and package versions are unchanged. The previous repository is kept
as a separate private archive.

## 1.2.63 — 2026-10-23

**Today respects hidden calendars.** When no calendars are marked
**Show on Today**, the hero and Tomorrow line no longer borrow events from
hidden calendars. Ambient mode still uses every calendar.

## 1.2.62 — 2026-10-23

**Personal pages respect an empty calendar selection.** A user with no
calendars selected now sees `No calendar selected` and an empty agenda instead
of another person's calendar events.

## 1.2.61 — 2026-10-23

**Personal page day summary.** The duplicate Next up hero is replaced by a
one-line summary such as `3 events left today · next at 3:00 PM`, followed by
that person's agenda. In-progress events read `in progress`; with nothing left,
the page shows `Free the rest of the day`.

## 1.2.60 — 2026-10-23

**Cleaner photo screensaver.** The calendar-colored people avatars below the
weather are removed from the ambient photo screensaver, so the photo view shows
only the clock, date, weather and next event.

## 1.2.59 — 2026-10-23

**Grocery continuation labels.** When a store list continues onto another page,
the store name now repeats at the top of its column, so continued items keep
their attribution. The label is not duplicated mid-column.

## 1.2.58 — 2026-10-23

**Grocery print layout.** Store lists now print side by side in columns instead
of stacked, and each quantity (x1, x2, and so on) appears directly beside its
item instead of at the far right edge. Long lists still paginate within the
columns.

## 1.2.57 — 2026-10-23

**Reorganized documentation.** The README now describes the frame features in
plain language with screenshot placeholders, adds a StartOS app screenshot
section, and explains every Actions & Config setting in detail. Technical
implementation notes moved to their own section.

## 1.2.56 — 2026-10-23

**Corrected About links.** Source code and marketing now point to the private
repository, while Upstream service points to wesbos/photo-frame-dashboard for
compatible-frame setup.

## 1.2.55 — 2026-10-23

**Private repository and updated About links.** The StartOS About source and
marketing links now point to this private repository. README credits Wes Bos
for the dashboard foundation and directs compatible-frame setup to the upstream
project, including the submitted Dragon Touch Classic10 Charm guide.

## 1.2.54 — 2026-10-23

**Default LAN printer scan range.** Printer Settings and the discovery API now
default to `192.168.1.0/24` for missing or blank subnet settings instead of
detecting a container network. Explicit custom subnets are preserved, clearing
the field restores the default, and saved printer names and URLs remain
unchanged.

## 1.2.53 — 2026-10-23

**Clearer empty printer-search guidance.** Empty or failed searches now direct
users to manual URL setup or their saved printer, without suggesting
unavailable discovery choices. Includes visible fresh-scan results and the
working manual selection from 1.2.52.

## 1.2.52 — 2026-10-23

**Clear printer discovery results and working manual setup.** Printer Settings
now visibly lists fresh discovery results and distinguishes rediscovered URLs
from saved settings, including empty or failed searches. The manual name/URL
option is selected by default and no longer triggers a required-field error,
so saved URLs can be submitted, edited or cleared even when discovery finds
nothing.

## 1.2.51 — 2026-10-23

**Printer discovery inside settings.** Printer Settings is now the only printer
action and searches the LAN when opened. A single discovered printer prefills
an unset name and URL; multiple results can be selected. Existing saved
printers are preserved, and failed or empty searches still allow manual URL
entry. Submit saves the chosen or edited printer for one-button background
printing.

## 1.2.50 — 2026-10-23

**Local-subnet printer discovery.** Discover Printers now combines Bonjour with
direct private IPv4 subnet scans on ports 631/443 and read-only IPP capability
queries. Select a PDF-capable printer and save its URL without typing. Printer
Settings adds an optional Scan subnet override for container or larger
networks. Manual URL entry and one-button background printing remain available.

## 1.2.49 — 2026-10-23

**Printer setup guide.** Manual IPP/IPPS URL entry remains in StartOS Printer
Settings. Both printer actions now link to detailed README instructions for Mac
Bonjour lookups, printer/router/Windows IP lookup, constructing the full URL,
saving it and keeping the address stable. Discovery limitations are explained;
the dashboard still prints directly to the saved printer.

## 1.2.48 — 2026-10-23

**One-button grocery printing.** Save the printer once in StartOS Printer
Settings, then press Print on Groceries to send the list in the background.
Browser printing, dashboard printer selection and URL entry are removed.
Printing uses the saved printer without waiting for discovery. Printer
Settings opens without scanning; discovery is a separate action and reports
startup errors.

## 1.2.47 — 2026-10-23

**Printer Settings LAN discovery.** The Printer Settings action now runs a live search for Bonjour/AirPrint printers when opened. You can select a printer from the local network instead of typing the URL manually. A manual URL field remains available as a fallback.

## 1.2.46 — 2026-10-22

**Groceries and printing.** Shopping is now Groceries, with Print list and
Clear all. Print this screen for a formatted list, or search Bonjour/AirPrint
printers and print from the box; set a default in Printer Settings. Calendar
also repaints after reconnect.

## 1.2.44 — 2026-10-22

**No demo fallbacks.** If the box cannot be reached, the dashboard shows a
full-screen "Dashboard cannot be reached" message instead of the demo
household. Weather without a location or forecast says Weather unavailable.
The fake Home status is replaced by a Control4 coming-soon card, the prototype
demo controls and fake alerts are removed, and the Agents section is gone.

## 1.2.43 — 2026-10-22
**Mid-Day routine.** The 11 AM–5 PM routine is now labelled Mid-Day instead of
After school in the Chores tab and Edit Chores. Saved chores stay in the same
routine; no reassignment is needed.

## 1.2.42 — 2026-10-22

**Live chore updates.** An open Chores section or personal home page now
repaints when the configured chore roster or users change, without navigating
away and back. Saved chores, assignments, and completion behavior are unchanged.

## 1.2.41 — 2026-10-22

**Editable chores.** Edit Chores lists the example chores, each with a title,
optional emoji, routine, star value, and an assigned user or Anyone. Rename,
reassign, or remove any row. This upgrade saves the examples once; later edits
and removals stay saved. Chores lanes and personal chore cards follow the
assignments.

## 1.2.40 — 2026-10-22

**Compact shopping entry.** The Add an item control is smaller, with less
padding, a smaller plus icon and text, and a 48px-tall input. More room
remains for the catalog without changing shopping list behavior.

## 1.2.39 — 2026-10-22

**Shopping starters on by default.** Prepopulated categories and items now
default to on, even with an existing custom catalog. This upgrade enables
the saved starter bank once without replacing edited or deleted rows.
Users can turn Use prepopulated defaults off and submit Edit Shopping;
that choice stays off across reloads and restarts.

## 1.2.38 — 2026-10-22

**Shopping catalog and store controls.** Starter categories are now saved
automatically on install and upgrade when no starter bank exists; empty
category placeholders no longer disable them. Explicitly disabled or edited
starters stay unchanged. All is back alongside Unspecified and named stores.
Unspecified items can be assigned to a store; quantities combine if that item
is already on the destination list.

## 1.2.37 — 2026-10-22

**Editable shopping starters.** Edit Shopping now offers common categories
and groceries with a Use prepopulated defaults toggle. Rename, add, or remove
starter categories and items just like your own. Switching defaults off
preserves your edits and current list; switching them on restores your edited
starters without bringing back deleted rows. Existing catalogs opt in; new
empty catalogs start prefilled.

## 1.2.36 — 2026-10-22

**Independent shopping lists per store.** Shopping starts on Unspecified.
Tap a store name to add to that store instead, regardless of the catalog
store setting. The same item can be added independently to each store, with
separate quantities, removal, and catalog checkmarks. Store lists survive
reloads; reloading starts on Unspecified.

## 1.2.35 — 2026-10-22

**Easier shopping setup.** Edit Shopping now has individual store rows and
category rows containing item rows. Add items by name, choose an optional
store from a dropdown, and toggle usual items without typing catalog syntax.
Existing catalog entries load automatically and the current shopping list is
preserved. Save and reopen the action to use newly added stores.

## 1.2.34 — 2026-10-21

**Tap what you need.** Shopping now uses the catalog from Edit Shopping: tap
items to build a list grouped by category, adjust quantity, and remove items
with one tap. There is no "got it" checkbox. The list is saved on the box, so it
survives reloads instead of resetting to demo data, and Today shows the same
count.

## 1.2.33 — 2026-10-21

**Clear at night, not Sunny.** Open-Meteo reports a numeric weather code, and
the dashboard supplies the words. It now asks Open-Meteo whether it is day or
night, so a clear night reads Clear with a moon icon on both Today and Weather
instead of Sunny. Rain, clouds and other conditions are unchanged.

## 1.2.32 — 2026-10-21

**Empty Today card no longer clips.** When nothing else is scheduled, "Enjoy
the quiet." sits fully inside the card instead of having its descenders cut
off. The normal next-event card is unchanged.

## 1.2.31 — 2026-10-21

**English only.** The package now ships a single English dictionary; the
Spanish, German, Polish and French interface translations have been removed.
Existing settings and dashboard behaviour are unchanged.

## 1.2.30 — 2026-10-21

**Sidebar order removed.** Edit Sidebar now only shows a show/hide toggle per
section, in a fixed order: Today, Weather, Calendar, Chores, Shopping, Photos,
Home controls, Agents. Today stays first. StartOS forms cannot render buttons,
arrows, or drag handles, so ordering controls are gone rather than left as
number selectors. Hidden sections remain reachable from Today cards and direct
links.

## 1.2.29 — 2026-10-21

**Section settings together.** Edit Sidebar now pairs each section's show/hide
toggle with its order selector, and the separate ordering block is gone.
StartOS forms do not support buttons, arrows or drag handles, so order remains a
position selector: lower numbers appear higher, Today stays first, and hidden
sections keep their positions.

## 1.2.28 — 2026-10-21

**Reorder the sidebar by position.** StartOS list rows have no drag handle, so
Edit Sidebar now gives every section a position selector instead of a text
list. Lower numbers appear higher; Today stays first, and hidden sections keep
their positions. Each section name is visible next to its own toggle and
position.

## 1.2.27 — 2026-10-21

**Calendars per user and per homepage.** Edit Calendars rows now show the
calendar name without opening them, and add an Assigned user selector plus a
Show on Today homepage toggle. Calendars assigned to a user are selected by
default on that user's personal page, and Edit Users can select any number of
calendars for that page. Calendars switched off stay in the Calendar tab but
leave Today's events and person lanes.

## 1.2.26 — 2026-10-21

**Add users as a list.** Edit Users now uses add/remove rows instead of a text
box. Each row has a name, optional colour, a Primary calendar selector filled
from Edit Calendars, and the cards for that person's page. A read-only Calendar
activity line, and the collapsed row label, show that user's next event from
the last sync, so run Sync Now and reopen the action to refresh it.

## 1.2.25 — 2026-10-21

**Users on Today.** Edit Users creates the people shown in the top-right
corner, replacing the calendar names that used to sit there. Tap a person to
open their personal home page: their calendar's next event plus the cards you
chose (calendar, weather, photos, chores, shopping, home). Removing a user
removes their page. Configure one user per line: Name | Color | Calendar |
Cards.

## 1.2.24 — 2026-10-21

**Hidden sections disappear from Today too.** A section switched off in Edit
Sidebar now leaves its Today card blank, and the clock/hero shortcuts no
longer open it. The photo slideshow stops while Photos is hidden. Direct
section links still work.

## 1.2.23 — 2026-10-21

**Choose your sidebar.** Edit Sidebar now shows every section name with its own
show/hide toggle directly on the form; no dropdowns to open. Today stays first
and fixed on. Reorder the sections in the display-order list. Hidden sections
stay reachable from Today cards and direct links. The frame applies changes on
its next one-minute refresh.

## 1.2.22 — 2026-10-21

**Choose your sidebar.** A new Edit Sidebar action controls which sections
appear in the rail and their order. Today always stays first; reorder the rest,
hide sections you do not use, and keep them reachable from Today cards and
direct links. The frame applies changes on its next one-minute refresh.

## 1.2.21 — 2026-10-21

**Use the current condition, not a later day.** Open-Meteo was already
reporting clear weather for the configured location: code 0, 0 mm, 61°F at
7:00 PM. The dashboard was overwriting each hour with the same hour from the
last forecast day, so drizzle six days later appeared as rain now. Current
conditions now use the API current weather code, and the 24 hourly slots keep
today only.

## 1.2.20 — 2026-10-21

**Show the forecast location.** The Weather header now identifies the
city/state and ZIP, resolved during weather sync. The postal city is separate
from a label such as Home, so existing ZIP configurations also show the right
place. Coordinate-only locations or failed city lookups show the configured
label and coordinates without dropping the forecast or guessing a city.
Forecasts remain from Open-Meteo; radar remains from RainViewer.

## 1.2.19 — 2026-10-21

**Buffer the radar and resume instantly.** The map stays visible with loading
progress while every radar tile loads and decodes. Playback starts only when
the full replay is ready. Returning to a ready replay, refreshing weather data
or changing map zoom reuses the decoded images without buffering again while
metadata is fresh. Tile cache headers are preserved. Failed or interrupted
loads cannot bypass the full buffering gate.

## 1.2.18 — 2026-10-21

**Buffer the radar before playing.** The map stays visible with loading
progress while every radar tile loads and decodes. Playback starts only when
the full replay is ready, avoiding partial frames on slow Wi-Fi. Tile cache
headers are now preserved, so revisiting Weather reuses cached images. Failed
tiles show an unavailable notice rather than an incomplete animation.

## 1.2.17 — 2026-10-21

**Real geography under the radar.** The radar now overlays a labeled
OpenStreetMap basemap with roads, cities and geographic outlines, plus U.S.
Census state/county boundaries. Zoom buttons switch between regional and closer
views while keeping precipitation aligned. Geographic tiles are proxied through
your box and cached for at least seven days; map credits remain visible.

## 1.2.16 — 2026-10-21

**Radar clarity and cache fixes.** Radar now has approximate 50/100 km rings and
a clear-area notice scoped to the local tile across the replay. Unknown probes
never count as clear. Echo detection runs on the box, not the frame, and tile
requests no longer invalidate metadata or repeat echo probes.

## 1.2.15 — 2026-10-21

**Radar explains a dry sky.** The radar panel now shows faint map gridlines
and, when there is no rain within the last two hours, a clear "No rain in the
last two hours" note instead of an apparently blank black screen. Rain echoes
appear as normal when present.

## 1.2.14 — 2026-10-20

**Location input guard.** Saving a location now rejects an empty or 0,0
coordinate pair with a clear message instead of silently writing coordinates
the weather service treats as "no location". Enter a ZIP code or real
coordinates.

## 1.2.13 — 2026-10-20

**Set the location by ZIP code.** Edit Location & Units now accepts a 5-digit
US ZIP and looks up its coordinates, so you no longer need to know latitude and
longitude. Coordinates still work, and a ZIP takes precedence when both are
filled in. The save message confirms the resolved place and coordinates. Also
fixes a config-parsing bug that could make the location action fail to open.

## 1.2.12 — 2026-10-20

**Radar fixes and correct hourly strip.** Radar tiles now come through your
server instead of loading directly from RainViewer, so they work on the frame's
older Android WebView, which lacks the certificate authority RainViewer's chain
ends at. The location dot now marks your actual coordinates rather than the
centre of a map tile, the loop starts as soon as the first frame arrives
instead of waiting for every tile, and the hourly strip shows the next 12 hours
across midnight instead of wrapping back to this morning.

## 1.2.11 — 2026-10-20

**Weather tab with live radar.** A new Weather tab in the rail, also opened by
tapping the weather card on Today, shows current conditions with feels-like,
humidity, wind, gusts and pressure, the next 12 hours, and a seven-day outlook
with rain chance and sun times. It includes a looping radar animation for the
last two hours centred on your location. Radar comes from RainViewer (free
public API, credited on screen); Open-Meteo supplies the forecast and has no
radar of its own. The box proxies the radar frame list so the frame still talks
only to your server.

## 1.2.10 — 2026-10-20

**Night mode refinements.** Turning off **Dim the screen at night** now takes
effect on the next refresh instead of waiting for a touch. The dimmed night
screen shifts its content slightly every minute to avoid leaving a fixed image
on the panel for hours, and a reload during quiet hours no longer restores the
dimmed view on a locked frame.

## 1.2.9 — 2026-10-20

**Night screen now dims instead of hiding the dashboard.** After two idle
minutes at night the rail, calendar and photos stay on screen, dimmed and
readable; one touch wakes it without pressing anything underneath. Actions &
Config → Edit Location & Units adds **Dim the screen at night** (on by default;
turn it off to use the ambient photo view again) and **Red night colours** to
remove blue light before sleep.

## 1.2.8 — 2026-10-20

**Night display and quiet-hour reload corrected.** At 03:00 the frame is
already in its dim night view, so the nightly reload now records that mode and
restores it after rebooting instead of leaving the dashboard lit. The
night/ambient choice also waits for a plausible clock, so a wrong boot time
cannot dim the display at midday. A calendar entry made only of emoji keeps its
text instead of rendering blank.

## 1.2.7 — 2026-10-20

**Boot clock, outage notice and long-run fixes.** The frame has no clock
battery, so until network time arrives the clock now shows "Waiting for network
time" instead of a confidently wrong date. An outage banner appears after two
minutes without the dashboard service and clears on reconnect. Calendar titles
drop emoji the frame's Android 6 font cannot draw, and the page reloads itself
once nightly at 03:00 when nobody is looking and no section is locked.

## 1.2.6 — 2026-10-20

**Month titles stay inside their cells.** Long event names now truncate with an
ellipsis instead of overflowing the day cell or covering the time, including on
the frame's older WebView.

## 1.2.5 — 2026-10-20

**Readable month calendar.** Month view now shows event titles, up to two per
day with "+N more", instead of colored dots. The grid fits the month's actual
weeks, so short months no longer leave an empty row. Month layout adapted from
wellavelino/frameo-homeassistant-dashboard (MIT). Also rejects an invalid
configured time zone without interrupting live data.

## 1.2.4 — 2026-10-18

**Clock, calendars and photo controls fixed.** The clock uses real time and the
configured IANA time zone, including daylight saving. Calendar names replace the
demo household; choose a basic color for each calendar. Apple webcal links are
supported. Photo arrows no longer overlap the lock.

## 1.2.3 — 2026-10-18

**Photo dates and album information.** Captions use the date a photo was taken,
not the date it was shared. Missing capture dates are marked unavailable.
Actions & Config now shows Photo Album Info with album names, photo counts, date
coverage and sync status. Removed the Favourite button and favourite weighting.

## 1.2.1 — 2026-10-18

**Fix iCloud photos.** Shared albums now sync correctly through both Apple APIs.
Photo updates replace the slideshow immediately, including its previous/next
queue. Empty albums show a clear message instead of demo photos.

## 1.2.0 — 2026-10-17

**New: live data.** The Photos section and screensaver now show your public
iCloud shared albums, the Calendar pulls your ICS calendar links (one color per
member), and weather comes from Open-Meteo at your location — all synced on the
box, with a **Sync Now** action and config actions for albums, calendars,
location and units.

## 1.1.0 — 2026-10-17

**New: screen lock.** Press and hold the padlock (bottom-right) to pin the
dashboard to a section or lock it entirely, with an optional passcode. Home
shows a Control4 placeholder until the integration lands. Lock overlay text
moved to the bottom.

## 1.0.0 — 2026-10-17

Initial release for StartOS.
