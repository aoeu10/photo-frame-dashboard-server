# Frame Dashboard

A family dashboard (calendar, weather, chores, groceries, photos) designed for a
full-screen Android photo frame, served from your own StartOS server.

## Documentation

- Upstream project: <https://github.com/wesbos/photo-frame-dashboard> (the
  `dashboard/` directory — this package adds live data, photo streaming and screen locking).
- The Android kiosk app that displays it on the frame is documented in that
  repository under `dashboard/kiosk/`.

## What you get on StartOS

- A plain-HTTP **Web Interface** on port 80 serving the dashboard as static
  files. LAN addresses (the server's `.local` hostname and LAN IP) are enabled
  by default and require **no login** — this is what the frame uses.
- The **Photos** section and screensaver stream from your configured public
  iCloud shared albums: the box refreshes the album metadata on its sync
  interval, and the frame loads each image straight from Apple's CDN. Nothing
  is copied to this box.
- Everything else is local: no accounts, no database, and the only other
  client-side resources are Google Fonts (everything else is served by this
  box).

## Getting set up

1. Download the package for your StartOS server's architecture from the
   repository's latest release, sideload it, start Frame Dashboard if needed,
   and wait for the health check to turn green.
2. Open **Interfaces → Web Interface** to confirm the dashboard renders.
   Record that interface's actual numeric LAN address and external port;
   test the full URL from another device on the frame's LAN. The service
   listens internally on HTTP port 80 and prefers external port 80, but use
   the port StartOS actually exposes, not an assumed port or the admin URL.
3. On the frame (requires ADB, see the photo-frame-dashboard repo for your
   model), point the kiosk at this service — from any computer with ADB:

   ```sh
   adb -s ADB_TARGET shell am start -n com.wesbos.homehq/.MainActivity \
     --es url 'http://STARTOS_LAN_IP:WEB_INTERFACE_PORT/'
   ```

   Replace `ADB_TARGET` with the frame's identifier from `adb devices`, and
   replace `STARTOS_LAN_IP:WEB_INTERFACE_PORT` with the tested service endpoint.
   The frame's ADB address is not the dashboard address. This saves the URL;
   follow upstream's model-specific Home-app steps separately for boot startup.
   No kiosk rebuild is needed just to change the saved URL.

   Do not use the `<package-id>.<server-name>.local` hostname on the frame:
   Android 6 cannot resolve mDNS `.local` names (desktop browsers can).
   Reserve the service's LAN IP in your router where applicable so the saved
   address stays valid. The frame loads the page directly over the LAN; no
   password is needed. Do not rely on optional kiosk LAN-recovery features
   to discover the correct server or an unknown port.

   For hardware preparation, a copyable agent prompt and discovery limitations,
   see [Set up your own frame in the README](README.md#set-up-your-own-frame).
4. Reaching the dashboard from the internet (e.g. `frame.example.com`) is
   **not part of this package yet**: the current build serves one open LAN
   binding only. A later package update will add a second, auth-gated
   binding (StartOS's reverse proxy can require a username/password before
   forwarding — enforced at the edge, so the dashboard itself stays
   password-free) for your domain with SSL, while the LAN binding stays open
   for the frame. Until that update exists, keep the dashboard on the LAN.

## Set up the clock and calendars

1. Open **Actions & Config → Edit Location & Units**. Set **Time zone** to
   your IANA zone, for example **America/Chicago**. It controls the dashboard
   clock, calendar times and weather. Leaving it blank uses the server's
   zone, normally UTC. The clock follows real time, including daylight saving.
2. Open **Edit Calendars** and add an entry for each calendar. Enter the
   **Name** to display on the dashboard (a person or “Family”), choose a
   basic **Color**, and paste its public read-only calendar link.
3. Each calendar row also has an **Assigned user**, **Show on Today homepage**,
   **School calendar** and **Meal calendar** toggle. Assign a calendar to a user to turn it on by
   default on that user's personal page. Switch the Today toggle off to keep it
   out of Today's events and person lanes; the Calendar tab still lists it.
   Turn on **School calendar** for any calendar that should feed the School
   section, or **Meal calendar** for the one calendar whose entries become
   Breakfast, Lunch and Dinner. A calendar cannot be both; choosing Meal also
   turns off **Show on Today homepage**.
4. Apple Calendar's `webcal://` links and HTTPS links are supported, including
   published links without a `.ics` suffix. The server fetches them; the
   frame never receives the source links.
5. Submit, then use **Sync Now** to request an immediate update. Your names
   and colors replace the demo household. Renaming or removing an entry
   updates the dashboard too. With no calendars configured, it shows setup
   guidance rather than demo names.

## Choose the sidebar sections

1. Open **Actions & Config → Edit Sidebar**.
2. Each section has a show/hide toggle. Today is fixed on and first; the other
   sections keep the built-in order, including Vestaboard. **Meals** and
   **School** start hidden, so turn them on when you want them.
3. Submit. The frame applies the new rail on its next one-minute refresh; no
   reload is needed. A hidden section's card on Today goes blank too, so no
   hidden content or shortcut remains there. Direct section links still work.

## Connect a Vestaboard

1. In the Vestaboard app, enable the **Local API** and copy the key it returns.
2. Open **Actions & Config → Vestaboard Settings**. Enter the board's private
   IPv4 address (for example `192.168.1.60`) or `vestaboard.local`, paste the
   Local API key, and choose **Flagship (6×22)** or **Note (3×15)**.
3. Submit, then open the **Vestaboard** section in the frame sidebar. Tap a
   palette character and tap or drag on the grid to draw. Use **Send** to push
   the message, or open **VBML** to compose centered text and preview it first.

The key stays on the StartOS server; the frame only receives the current
message and board size. The board must be reachable on the same private
network on port 7000.

## Add users

1. Open **Actions & Config → Edit Users**.
2. Add a row per person. Enter a **Name**, pick a **Color** from the same
   palette as calendars, select the **Calendars** their personal page should
   show, and tick the cards it should display. Calendars assigned to that user
   in **Edit Calendars** are selected by default.
3. The **Calendar activity** line and the row label show that user's next event
   across their selected calendars from the last sync. Run **Sync Now** and
   reopen the action to refresh it.
4. Submit. The top-right corner of Today lists each user. Tap one to open their
   personal home page; tap **Today** to return.

Available cards are `calendar`, `weather`, `photos`, `chores`, `shopping`
(Groceries) and `home`. Leaving them empty uses `calendar, weather, photos`.

## Chores

1. Open **Actions & Config → Edit Chores**.
2. The example chores are prefilled, one row each. Expand a row to edit its
   **Chore** name, optional **Emoji** (blank shows ✅), **Routine** (Morning,
   Mid-Day or Evening), **Assigned to**, and **Stars** (0–10).
3. **Assigned to** lists **Anyone** plus every user from **Edit Users**. A chore
   assigned to a user appears in that user's lane, their Today progress ring
   and their personal-page chore card. **Anyone** chores appear in the Anyone
   lane and ask who did it when completed. Add rows for more chores, or remove
   rows you do not want.
4. Submit. The frame applies the roster on its next one-minute refresh; no
   reload is needed. Saved edits and removals stay saved, including an empty
   list. Completion marks are per screen session and are not stored.
5. If a chore is assigned to a user who was renamed or removed, it moves to the
   Anyone lane. Reassign it after saving users.

## Groceries

1. Open **Actions & Config → Edit Groceries**.
2. **Use prepopulated defaults** is on by default, including with an existing
   custom catalog. The 1.2.39 upgrade turns the saved starter bank on once,
   without replacing edits or restoring deleted rows. To opt out, turn the
   toggle off and **submit** Edit Groceries. It stays off across reloads and
   restarts; merely opening the form is not a save.
3. **Prepopulated categories (editable)** contains Produce, Dairy & Eggs,
   Bakery, Meat & Fish, Pantry, Frozen, Snacks, Beverages, and Household, with
   common items such as apples, milk, eggs, bread, rice, coffee, and dish soap.
   Open any row to rename it, add items, or remove items or whole categories.
   Saved edits and removals stay saved; reopening never restores deleted rows.
4. Turning defaults off excludes those starter rows from the frame, but keeps
   their edits for later. **Your categories** are always included and can also
   be added, edited, or removed. If an item appears in both lists, your own
   version wins, ignoring differences in capitalization.
5. Under **Stores**, add stores individually (optional). Save and reopen before
   selecting a newly added store in an item dropdown. Items can be marked
   **Usual item** for quick-pick tiles; the empty store is **Unspecified**.
   Submit to save. Existing catalog rows load under Your categories, and
   editing or disabling starters never clears the current shopping list.
6. On the frame, **Unspecified** is selected by default. Tap a store name to
   choose that store's list, then tap catalog items to add them there.
   The selected tab, not the catalog's store setting, determines the destination.
   The same item can be added independently to Unspecified and each store.
   Tapping again raises only that store's quantity; minus/plus and × affect
   only that store's entry. Switching stores also updates the catalog checkmarks.
   **All** shows every store's entries with store labels. Adding from All goes
   to Unspecified, so no store is chosen implicitly; its catalog checkmarks
   reflect the Unspecified list.
   On an Unspecified item, choose **Assign store…** to move it to a named store.
   If that item is already there, quantities combine and both notes are kept.
   Other stores' copies are unaffected.
7. The list is stored in `config.json` on the box and survives reloads.
   Reloading starts on Unspecified without changing saved store assignments.

The compact **Add an item** field also filters the catalog as you type.
Press Enter to add the typed name. Names not in the catalog go under Other.

To set up printing, open **Actions & Config → Printer Settings**. It searches
the LAN automatically; allow about 30 seconds for the form to appear. If one
printer is found and none is saved, its name and URL are filled in. If several
are found, choose one under **Discovered printers**. If discovery finds nothing
or fails, enter a full `ipp://` or `ipps://` URL manually.

The note beneath **Discovered printers** lists the URLs found by this search
and says whether the URL below was rediscovered or just loaded from saved
settings. Empty and failed searches are reported explicitly. **Use the name
and URL fields below** is selected by default; leave it selected for manual
setup or to keep the saved URL.

Press **Submit** to save. Opening the form never changes the saved printer;
an existing URL remains in the fields until you edit it or select a discovered
replacement. The saved printer survives reloads and service restarts. To clear
it, choose **Use the name and URL fields below** and clear the URL before
submitting.

On Groceries, press **Print** to send the list directly from StartOS to that
saved printer. Store lists print side by side in columns, and each quantity
sits beside its item. There is no browser print dialog, URL field or printer
selector on the dashboard. If no printer is saved, the error directs you to
StartOS. **Clear all** removes every item from every store after confirmation.

Discovery combines Bonjour announcements with direct probes on ports **631 and
443**, defaulting to **`192.168.1.0/24`** (`192.168.1.1`–`192.168.1.254`).
Missing or blank subnet settings use this default, not an automatically
detected container network. Discovery queries IPP attributes without printing,
excludes ordinary web servers, and lists PDF/Print-Job-capable printers.

If your printer is on another network, change **Scan subnet (optional)** in
**Printer Settings** to a range containing it, for example `10.0.0.0/24`,
save, then reopen Printer Settings to search it. Custom ranges are preserved;
clearing the field restores `192.168.1.0/24`. Scans are restricted to private
IPv4 networks with at most 1024 addresses and a 25-second probing budget.
Oversized/public ranges are rejected; a smaller selected range must contain
the printer.

Manual IPP URL entry remains available for printers outside the range or using
an unusual port/resource path. Printing itself does not require discovery.

### Find and save a printer URL manually

If discovery finds nothing, read the printer's IPv4 address from its
**Network / Wi-Fi status** screen, its printed network report, or your router's
**Connected devices / DHCP clients** list. Open the printer's web interface at
that address and check its IPP/AirPrint settings or manufacturer documentation
for the port and resource path. Do not paste the printer's administration-page
URL into Printer Settings.

For example, an IP of `192.168.1.50`, IPP port `631` and resource path `ipp/print`
form `ipp://192.168.1.50:631/ipp/print`. These are examples, not defaults for
every printer. Secure IPP uses `ipps://` and the advertised secure port.
Enter the complete URL in **Printer Settings**, submit/save the form, reopen
it to confirm the saved value, then press **Print** on Groceries. A router DHCP
reservation keeps the printer's address stable.

The [README printer setup guide](https://github.com/aoeu10/photo-frame-dashboard-server#find-your-printers-ipp-url)
has detailed steps, including the exact Mac `dns-sd` commands to obtain the
service's hostname, port, `rp` path and numeric IP. Run those commands on your
Mac, not in the StartOS container. They inspect the printer without printing.

## Set up your iCloud photos

1. Use a **public shared album** in Apple Photos. A private Shared Photo
   Library or an invitation-only album is not a public album link; enable
   the album's public website/link-sharing option first.
2. In StartOS, open **Frame Dashboard → Actions & Config → Edit Photos &
   Albums**. Add the public album link and an optional name; the row also shows
   the shared album name Apple reports from the last sync, then submit.
   Supported links are `https://photos.icloud.com/shared/album/<token>/`
   and `https://www.icloud.com/sharedalbum/#<token>` (including China domains).
3. Run **Sync Now**. Once Apple responds, the dashboard picks up the photo
   list on its next one-minute refresh. Photos stream directly from Apple;
   you do not need to copy files or enter your Apple account password.
4. If no photos are available, the photo area shows a message instead of
   demo pictures. Check that the link opens without signing in and that the
   shared album contains photos. Check **Logs** in StartOS for sync errors.
5. **Photo Album Info** in Actions & Config shows the synced album name and
   photo count. Open it for the actual Apple album name, your dashboard
   label, capture-date availability, oldest/newest capture dates, sync status
   and last-sync time. Reopen it after **Sync Now** to see updated details.

Photo captions show **when each photo was taken**, not when you added it to
the album. If Apple does not expose that date, the caption says **Date taken
unavailable** instead of guessing. The photo's own timezone is used when
available. All photos in the shared album are included; there is no Favourite
button or extra favourite weighting.

After installing a package update, reload the dashboard on the frame once
to load the updated application. Your saved album settings are retained.

## Weather and radar

Tap **Weather** in the left rail, or tap the weather card on Today, for the full
forecast: current conditions with feels-like, humidity, wind, gusts and pressure,
the next 12 hours, and seven days with rain chance and sunrise/sunset.

If no location is configured, or the forecast cannot be fetched, Weather and
Today say **Weather unavailable** instead of showing demo data. Set a location
in **Edit Location & Units** and run **Sync Now**.

The forecast comes from [Open-Meteo](https://open-meteo.com/). Beside **Weather**,
the header shows the city/state and ZIP for a ZIP-based location. For coordinates
without a ZIP, or if the city lookup fails, it shows your configured location
label and coordinates rather than guessing a city.

The same screen runs a looping radar animation of the last two hours centred on
your configured location. Radar imagery comes from
[RainViewer](https://www.rainviewer.com/) — a free public service for personal use
that requires no account; the panel credits it on screen. Open-Meteo, which
supplies the forecast, does not provide radar. If radar cannot be reached, the
panel says **Radar unavailable** and the forecast still works.

The map appears first. **Loading radar N%** shows buffering progress; playback
waits until the whole replay has loaded and decoded, rather than stuttering
through images that are still arriving. Returning to Weather reuses cached
tiles. If a replay tile fails, **Radar unavailable** appears instead of a
partial animation.

The map beneath the radar shows city names, roads and geographic outlines from
**OpenStreetMap**, plus U.S. state/county boundaries from the **U.S. Census Bureau**.
Use **− / +** above the map for a regional or closer view. The radar remains
aligned as you zoom; closer views enlarge the source radar rather than adding
new detail. Map credits stay visible at the bottom. Map tiles are fetched through
your StartOS box and cached for at least seven days.
**Local tile: no significant echoes** means the box checked the location's
centre tile throughout the replay and found no significant returns. It does not
describe the whole visible area or override the weather forecast. If a probe
fails, the clear-area notice stays hidden rather than guessing. This notice is
also hidden in closer views because its source tile covers a larger area.

Weather and radar use the location set in **Edit Location & Units**. The easiest
way to set it is a **5-digit US ZIP code** — the box looks up its coordinates, so
you do not need latitude and longitude. Coordinates still work, and a ZIP takes
precedence when both are filled in; the save message confirms the resolved place.
Radar covers roughly a city-scale area around that point.

## Night display

After the frame sits idle at night, it **dims the dashboard** instead of
replacing it with a clock. Photos, calendar and text stay readable, and the
first touch wakes the screen without activating anything underneath. Set this
in **Actions & Config → Edit Location & Units**:

- **Dim the screen at night** (on by default) — dim the live dashboard. Turn it
  off to keep the older behaviour: the ambient photo view after idle.
- **Red night colours** (off by default) — tint the dimmed screen red to remove
  blue light before sleep. It applies only while dimmed; the awake screen keeps
  its normal colours.

Night dimming starts after two idle minutes; the screen returns to normal on
the first touch.

## Screen lock

Press and hold the **padlock** in the bottom-right corner for the lock options:

- **Lock to <section>** — the frame stays on that section and touch inside it
  still works (calendars stay scrollable, lists stay checkable), but nothing
  can navigate away.
- **Lock entirely** — the frame stays on the current section and nothing can
  be edited or changed; a dim overlay with the lock message sits along the
  bottom of the screen.
- **Set / Change / Remove Passcode** — an optional code guards unlocking;
  changing or removing it asks for the current one first.

The locked state survives reboots and power cycles. While locked, the idle
dimming is paused. To unlock, press and hold the **padlock** in the bottom-right
corner — the only on-screen hint is the line at the very bottom — and enter the
passcode if one is set.

## If the dashboard cannot be reached

If the frame cannot load `/api/frame` from the StartOS box, the whole screen
shows **Dashboard cannot be reached** with a reminder that it retries
automatically. It does not fall back to the demo household. Check that the
StartOS service is running and that the frame can reach the box's LAN address;
the dashboard returns on the next successful poll.

## Updating the dashboard content

The page is built into the package image. A new dashboard ships as a package
update, not a file edit: rebuild the `.s9pk` from updated sources and install
it. Because `index.html` is served `Cache-Control: no-cache`, the frame picks
up a new deploy on its next reload without clearing any cache.
