# Frame Dashboard for StartOS

A private StartOS package that turns a cheap Android photo frame into a family
dashboard, hosted locally on your own StartOS server. The frame loads one LAN
page full screen; nothing on the frame needs an account. 

This project was possible thanks to the direction and dashboard foundation in
[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).
Go there to learn how to get the dashboard running on a compatible photo frame.
This repository documents the owner's tested
[Dragon Touch Classic10 Charm](docs/dragontouch-classic10-charm.md) and a DPF Frame 156, but it is
not a substitute for upstream's current device index and setup instructions.

## Set up your own frame

### 1. Prepare the frame using Wes Bos's guide

Start at **[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)**,
the project that inspired this package. Follow its
[device index](https://github.com/wesbos/photo-frame-dashboard/blob/main/docs/devices.md)
and the guide for your frame's **actual model, board and firmware**, then its
[Home HQ kiosk instructions](https://github.com/wesbos/photo-frame-dashboard/blob/main/dashboard/kiosk/README.md).
Frames sold under the same name can contain different hardware. Have your agent
identify the device, establish ADB access and follow upstream's backup and
recovery checks before any destructive change; do not blindly flash another
model's firmware or disable the only way back into Android Settings.

Use upstream for preparing the hardware and installing the kiosk, **not its
hosted demo dashboard**. For this setup, the dashboard and live-data service run
on StartOS; the frame is the full-screen web client.

### 2. Install and start Frame Dashboard on StartOS

1. Download `frame-dashboard_x86_64.s9pk` from this repository's
   **[latest release](https://github.com/aoeu10/photo-frame-dashboard-server/releases/latest)**.
   This asset is for an **x86_64 StartOS server**, not the Android frame.
   The package targets **StartOS 0.4**; access to this private repository is
   required to download it.
2. Use StartOS's package-sideload flow to install it. Open **Frame Dashboard**,
   start the service if necessary, and wait for its health check to pass.
3. Open **Interfaces → Web Interface** and confirm that the dashboard loads.
   Under **Actions & Config**, set location/time zone, calendars, users, photos
   and any other settings you need; then run **Sync Now**.

### 3. Find and test the service's LAN IP and port

Use the **numeric LAN address and external port for this service's Web
Interface shown by StartOS**. Record the complete URL, including `http://`,
the port when needed, and any path. Do not use the StartOS administration-page
URL, the frame's own IP, or a container-only address.

The package serves HTTP on **internal port 80** and requests **external port
80**, but that is a preference, not a promise that every installation will
use it. Copy the actual LAN endpoint from StartOS rather than guessing a port.
For example, **only if your interface actually uses these values**:

```text
http://192.168.1.50:8080/
```

Here `192.168.1.50` and `8080` are examples, not built-in defaults. If the
actual HTTP port is 80, `http://YOUR_LAN_IP/` is equivalent to
`http://YOUR_LAN_IP:80/`.

Test that exact URL from another device on the frame's LAN before changing the
frame. If StartOS presents a `.local` address, obtain the numeric LAN address
and port for that same interface; Android 6 frames do not resolve mDNS
`.local` names. Keep the frame and service on networks that can reach one
another, without guest-Wi-Fi/client isolation blocking them. Reserve the
service's LAN IP in your router where applicable so the saved URL stays valid.
The dashboard's LAN interface has **no login**: keep it on a trusted network
and do not port-forward the dashboard or ADB to the internet.

### 4. Give your agent the tested URL

Replace the bracketed values below, then give this prompt to the agent working
on the computer connected to your frame:

```text
Set up my Android photo frame as a full-screen client of my local
StartOS-hosted Frame Dashboard.

Hardware guide: https://github.com/wesbos/photo-frame-dashboard
Kiosk guide: https://github.com/wesbos/photo-frame-dashboard/blob/main/dashboard/kiosk/README.md
Dashboard URL: [paste the complete tested StartOS LAN URL, including its port]
Frame model / firmware / Android version: [my frame's details]
ADB target: [the serial or IP:ADB_PORT shown by adb devices]

Identify the frame and follow its matching upstream guide. Explain proposed
device changes and obtain my approval before writes; verify backups before
firmware changes. Keep a working route to Android Settings and a recovery plan.

Install/configure the compatible Home HQ kiosk if needed. Serve the dashboard
from StartOS, not from the frame or the upstream hosted demo. Use the supplied
URL exactly; do not guess the server address or scan for an unknown port.
For the upstream com.wesbos.homehq kiosk, save the URL with:

adb -s ADB_TARGET shell am start -n com.wesbos.homehq/.MainActivity --es url 'DASHBOARD_URL'

Replace ADB_TARGET and DASHBOARD_URL with my actual values. Preserve the old
URL so the change can be undone. This saves the URL for later launches;
it does not by itself make the kiosk the default Home app.

After confirming the dashboard loads, follow the model/Android-specific
upstream steps to make the kiosk start at boot. Keep another usable launcher
or recovery route. With my approval, reboot and verify the dashboard returns
after Wi-Fi connects. Ask me to confirm full-screen display and the route
back to Settings on the physical panel; report any unverified behavior.
```

The **ADB target** identifies the frame; the **dashboard URL** identifies the
StartOS service. They are different addresses and may use different ports.
An already-installed compatible kiosk normally needs only the saved-URL change,
not a rebuilt APK or a new StartOS package.

### Does the frame automatically find the server?

**Initial setup uses a saved URL, not automatic StartOS discovery.** The
standard Home HQ kiosk accepts the URL at runtime and keeps it across launches
and reboots; it is not compiled to a particular household's IP address.
The dashboard then fetches `/api/frame` from that same server.

The locally maintained kiosk source used for these frames also includes
**limited offline LAN recovery**: after a load failure on Wi-Fi, it can scan
the saved IPv4 address's `/24` and the frame's `/24` for a page containing
`Home HQ`, then save a matching address. It keeps the saved **scheme, port and
path**; it does not discover an unknown port or reliably distinguish multiple
dashboard servers. This is a kiosk-APK feature, **not part of the StartOS
package**, and its presence depends on the APK installed on your frame.
Do not rely on it for first-time setup: always supply the tested LAN URL,
and update the saved URL if the service's address or port changes.

## Tested frames

| Frame | Display | Status |
| --- | --- | --- |
| [Dragon Touch Classic10 Charm](docs/dragontouch-classic10-charm.md) | 1280 × 800 | Works, full screen |
| DPF Frame 156 (`FRAME156`, RK3326, Android 8.1) | 1920 × 1080 | Works, full screen. The vendored dashboard includes upstream's 16:9 fill fix ([#226](https://github.com/wesbos/photo-frame-dashboard/pull/226)) and its follow-up height scaling, so the stage fills the panel instead of showing 96 px side bars. 1280 × 800 frames are unchanged. |

## Screenshots

Real dashboard captures at the frame's **1280 × 800** resolution, using a fictional
Boise family: **Dad, Mom, John (6), and Susan (2)**. Calendars, chores and groceries
are made up; the Boise and Seattle forecasts, radar and maps use real provider data.
No real household settings or private calendar links are used.

The [reusable family fixture](tools/screenshots/family.json) and
[capture instructions](tools/screenshots/README.md) are included for future updates.

### Today

![Today with four family calendars, the next event, weather, photos, chores and groceries](docs/images/frame-today.png)

<details>
<summary>Weather and live radar — Boise, Idaho and Seattle, Washington</summary>

Current conditions, the next 12 hours, seven days and the fully loaded radar replay.
The capture was dry around Boise; the radar has not been replaced with artificial rain.

![Boise weather and regional live radar](docs/images/frame-weather.png)

The map can also zoom into the local area.

![Live radar zoomed into Boise](docs/images/frame-weather-local.png)

**Seattle-area rain overlay:** actual precipitation bands west and north of
Seattle, shown over the labelled map and state/county boundaries.

![Seattle-area regional radar with real precipitation bands](docs/images/frame-weather-seattle.png)

A closer Puget Sound view keeps roads and place names visible beneath the radar.
**Rain now** is the forecast at the city marker; it can read zero while the
last-two-hours radar replay shows rain nearby or earlier.

![Seattle precipitation overlay on the closer Puget Sound map](docs/images/frame-weather-seattle-local.png)

</details>

<details>
<summary>Calendar — Today, 3 Day, Week and Month</summary>

**Today:** one lane for each person's calendar, with shared family events.

![Today calendar with Dad, Mom, John and Susan lanes](docs/images/frame-calendar.png)

**3 Day:** the next three days together.

![Three-day family calendar](docs/images/frame-calendar-3day.png)

**Week:** a rolling seven-day schedule.

![Week calendar](docs/images/frame-calendar-week.png)

**Month:** recurring activities and special dates across the month.

![Month calendar](docs/images/frame-calendar-month.png)

</details>

<details>
<summary>Chores — morning, mid-day and evening</summary>

Age-appropriate chores for each person, plus **Anyone** tasks. Some have been
checked off using the dashboard controls to show progress.

![Partially completed morning chores](docs/images/frame-chores-morning.png)

![Partially completed mid-day chores](docs/images/frame-chores.png)

![Partially completed evening chores](docs/images/frame-chores-evening.png)

</details>

<details>
<summary>Groceries — two stores and the All view</summary>

**Boise Co-op:** selected produce and bread, with quantities beside each item.

![Boise Co-op list and selected catalog items](docs/images/frame-groceries-coop.png)

**Costco:** eggs, milk and pantry staples.

![Costco grocery list](docs/images/frame-groceries-costco.png)

**All:** both stores' items together, keeping their store assignments.

![All groceries grouped by category and labelled with their stores](docs/images/frame-groceries.png)

</details>

<details>
<summary>Photos — Cover, Collage and Polaroid layouts</summary>

The demo album contains credited forest and mountain photos from Unsplash.
Original capture dates are unknown, so the dashboard honestly shows
**Date taken unavailable** rather than inventing dates.

![Forest or mountain photo in Cover layout](docs/images/frame-photos.png)

![Three nature photos in Collage layout](docs/images/frame-photos-collage.png)

![Nature photo in Polaroid layout](docs/images/frame-photos-polaroid.png)

</details>

<details>
<summary>Meals — Today, 3 Day and Week</summary>

Enable **Meals** in **Edit Sidebar** and mark its source calendar as
**Meal calendar** in **Edit Calendars**. Entries are grouped by their start
times: **Breakfast** (7–9 AM), **Lunch** (11 AM–1 PM), and **Dinner** (5–7 PM).
The page shows meal names as bullet lists, without event times.

**Today:** three meal cards with the fictional family's pancakes, sandwiches
and taco dinner.

![Meals today with Breakfast, Lunch and Dinner](docs/images/frame-meals.png)

**3 Day:** today and the next two days, with meals grouped within each column.

![Meals 3 Day view](docs/images/frame-meals-3day.png)

**Week:** the next seven days, starting today.

![Meals Week view](docs/images/frame-meals-week.png)

</details>

<details>
<summary>School — Today, 3 Day, Week and Month</summary>

Enable **School** in **Edit Sidebar** and mark one or more calendars as
**School calendar** in **Edit Calendars**. Only those calendars' activities
appear here; the demo uses a fictional **Lincoln Elementary** calendar.

**Today:** an agenda with all-day Spirit day and a timed first-grade activity.
When today is empty, the page shows the next upcoming activities instead.

![School today with an all-day and a timed activity](docs/images/frame-school.png)

**3 Day:** today and the next two days, including a field trip, music class and
library day.

![School 3 Day view](docs/images/frame-school-3day.png)

**Week:** seven days starting today, with unscheduled days marked **Free**.

![School Week view](docs/images/frame-school-week.png)

**Month:** a Monday-first overview, with **+ more** when a day has additional
activities.

![School Month view](docs/images/frame-school-month.png)

</details>

<details>
<summary>Dad's personal page</summary>

Dad's remaining-day summary, his own agenda, weather, photo and chore progress.

![Dad's personal dashboard](docs/images/frame-person.png)

</details>

<details>
<summary>Photo screensaver and red-light night mode</summary>

The idle photo screensaver keeps the clock, date, weather and next event visible.

![Mountain photo screensaver with clock, weather and next event](docs/images/frame-screensaver.png)

The actual dimmed red-light mode, without brightening the screenshot.

![Dim red-light night mode](docs/images/frame-night-red.png)

</details>

<details>
<summary>Screen locking — options, pinned section, full lock and passcode</summary>

Hold the padlock to choose how to lock the frame.

![Screen lock options](docs/images/frame-lock-options.png)

Pinning a section disables navigation but leaves its controls usable.

![Today pinned with a confirmation message](docs/images/frame-lock-pinned.png)

Full lock prevents edits. Only a single line at the very bottom says the frame
is locked and that holding the padlock unlocks it.

![Fully locked dashboard with the touch-blocking shield and bottom hint](docs/images/frame-lock.png)

An optional passcode protects unlocking. The demo uses a disposable passcode,
not a real household credential.

![Passcode keypad for unlocking the dashboard](docs/images/frame-lock-passcode.png)

</details>

## What it does

- **Today at a glance.** Serves as the main homepage. This displays a list of all the active sidebars on the left. A clock with the date below it. Local forecast over the next 7 hours. A users list to access their personal pages. Active calendars for each user. Photos from the shared photo libraries. And widgets for Chores, Groceries to get, and a future section for Control4 integration for the Home. Each of these are able to be tapped to go directly into their page for more details.
- **Weather and radar.** Current conditions, the next 12 hours, a seven-day
  forecast and an animated rain radar over a labelled map.
- **Shared calendars.** Provider-independent calendar integration using the
  **iCalendar (ICS) format**: any calendar service that exposes a public,
  read-only ICS feed is supported. Today-by-person, three-day, rolling week
  and month views show each calendar in its own colour, with optional
  assignment to a person.
- **Meals.** Mark one calendar as the meal calendar in Edit Calendars. Its
  entries that start 7–9 AM, 11 AM–1 PM and 5–7 PM appear as bullet lists under
  Breakfast, Lunch and Dinner, with Today, 3 Day and Week views; times are not
  shown.
- **School.** Mark calendars as school calendars in Edit Calendars; the School
  section lists their activities with Today, 3 Day, Week and Month views like
  the Calendar section. School events also appear on the personal page of the
  user that calendar is assigned to, or selected for in Edit Users.
- **Chores.** Morning, mid-day and evening routines with per-person progress
  rings. Assign a chore to a family member or leave it for **Anyone**. The chores are able to be configured via the StartOS Actions & Config menu discussed below.
- **Groceries.** Tap items from your catalog to build a list grouped by
  category and store. Print the open items to a printer connected on the local network. Store
  lists are printed side-by-side, with each quantity beside its item.
- **Photos.** Integrates **iCloud shared albums** and **Immich albums**. A
  full-screen slideshow displays them in five layouts. iCloud photos stream
  from Apple's CDN; Immich photos are fetched by the box and served through
  it, so the frame never contacts your Immich server and the API key stays on
  the box. Sync stores metadata only.
- **Vestaboard.** A rail view for drawing directly on a Flagship (6×22) or
  Note (3×15) board, with a VBML template preview and send button. StartOS
  proxies the Local API, so the board key never reaches the frame.
- **Personal pages.** Each person gets a home page with a one-line summary of
  what is left today, their agenda, and the cards they chose: calendar,
  weather, photos, chores, groceries and home controls.
- **Night mode and screen lock.** Dim the dashboard after idle, optionally with
  red tinting, and lock the frame to one section or behind a passcode.

## StartOS app screenshots

### Actions & Config

The service's settings and maintenance actions live in **Frame Dashboard →
Actions & Config**. These supplied screenshots show package **1.2.73:0**.

**Upper portion:** Sync Now, location and units, calendars, users, photo albums,
album information and sidebar visibility.

![StartOS Actions & Config showing Sync Now, location, calendars, users, photos and sidebar settings](docs/images/startos-actions.png)

**Lower portion:** groceries, chores, printer and Vestaboard settings, followed
by StartOS's Rebuild Service and Uninstall actions.

![StartOS Actions & Config showing groceries, chores, printer, Vestaboard and service maintenance actions](docs/images/startos-actions-more.png)

### Settings forms

Supplied screenshots of the individual settings forms. Location name, ZIP code,
coordinates and time zone have been blanked in **Edit Location & Units**.
Printer identity, address and subnet have also been blanked in **Printer
Settings**. The other screenshots are unchanged.

<details>
<summary>Edit Location & Units</summary>

Location and temperature settings, with location values removed.

![StartOS Edit Location & Units with location name, ZIP code, latitude, longitude and time zone blanked](docs/images/startos-location.png)

</details>

<details>
<summary>Edit Calendars</summary>

Calendar name, colour, public ICS link, assigned user and Today visibility.

![StartOS Edit Calendars form showing an empty calendar row](docs/images/startos-calendars.png)

</details>

<details>
<summary>Edit Users</summary>

User name, colour, calendar selection and personal-home cards.

![StartOS Edit Users form showing colour, calendars and personal-home card choices](docs/images/startos-users.png)

</details>

<details>
<summary>Edit Photos & Albums</summary>

Shared album links, optional display names and the read-only album name.

![StartOS Edit Photos and Albums form showing an expanded album row](docs/images/startos-photos.png)

</details>

<details>
<summary>Edit Sidebar</summary>

Visibility toggles for the dashboard sections.

![StartOS Edit Sidebar form showing section visibility toggles](docs/images/startos-sidebar.png)

</details>

<details>
<summary>Edit Groceries</summary>

Editable starters, stores and grocery categories.

![StartOS Edit Groceries form showing prepopulated defaults, stores and categories](docs/images/startos-groceries.png)

</details>

<details>
<summary>Edit Chores</summary>

Expandable chore rows with emoji and activity names.

![StartOS Edit Chores form showing the editable chore list](docs/images/startos-chores.png)

</details>

<details>
<summary>Printer Settings</summary>

LAN discovery results, printer name and URL, and the scan subnet.

![StartOS Printer Settings form showing discovery results and saved printer fields](docs/images/startos-printer.png)

</details>

<details>
<summary>Vestaboard Settings</summary>

Board address, Local API key and board-size selection.

![StartOS Vestaboard Settings form showing empty address and API key fields with Flagship selected](docs/images/startos-vestaboard.png)

</details>

## Install

Follow **[Set up your own frame](#set-up-your-own-frame)** above for the full
sequence: prepare the hardware using upstream's model-specific instructions,
install and start the StartOS service, test its actual numeric LAN URL and
port, then give that URL to the agent configuring the kiosk. Do not assume
that installing the StartOS package configures or discovers the frame.

See [docs/PACKAGE.md](docs/PACKAGE.md) for package internals, data layout,
upgrade notes and verification details. User-facing setup steps are in
[instructions.md](instructions.md).

## StartOS settings

All settings live under **Actions & Config**. Opening an action loads its
current values; nothing changes until you press **Submit**. Saved changes are
merged into `config.json`, so editing one area never clears another. The
service notices the change within about ten seconds and starts a new sync; no
restart is needed. After changing something that affects a form's choices
(for example adding a store or calendar), reopen the action to see the new
choice.

| Action | What it does |
| --- | --- |
| Sync Now | Immediate refresh of photos, calendars and weather |
| Edit Location & Units | ZIP or coordinates, time zone, temperature unit, night display |
| Edit Calendars | ICS links, colours, assigned user, Today visibility, school or meal |
| Edit Users | People, colours, calendars, personal-page cards |
| Edit Photos & Albums | iCloud shared album links plus Immich server, API key and album |
| Photo Album Info | Album sources, names, counts, capture dates and last sync |
| Edit Sidebar | Show or hide rail sections |
| Edit Groceries | Categories, item rows, stores and usual-item toggles |
| Edit Chores | Chore rows with emoji, routine, star value and user-or-Anyone assignment |
| Printer Settings | Discover a LAN printer or save an IPP/IPPS URL manually |
| Vestaboard Settings | Board address, Local API key and Flagship/Note size |

The list above is the order StartOS shows these actions; their ids carry
numeric prefixes because StartOS sorts actions by id.

### Edit Photos & Albums

Two album lists are available: **Albums** for public iCloud shared albums and
**Immich albums** for albums on an Immich server. Each row has an optional
label and a read-only **Album name** taken from the last sync, so the list
shows which album each row points to.

#### iCloud shared albums

Add one row per public iCloud shared album.

- Both modern `photos.icloud.com/shared/album/<token>/` and legacy
  `www.icloud.com/sharedalbum/#<token>` links work, including `icloud.com.cn`.
- The album must be shared as **Anyone with the link**.
- Sync stores metadata only. Photos stream from Apple's CDN straight to the
  frame; the box never copies the images.
- Captions use Apple's capture timestamp. A missing capture date says
  **Date taken unavailable** rather than guessing.

#### Immich albums

Add one row per Immich album:

- **Immich server URL** — the base URL, for example
  `http://192.168.1.50:2283`. A reverse-proxy subpath such as
  `https://example.com/immich` is allowed. Immich on StartOS or UmbrelOS uses
  that device's LAN address and published port.
- **Immich API key** — create one in Immich under **Account Settings → API
  Keys** with `album.read`, `asset.view` and `asset.read` permissions
  (`asset.read` is used for album asset search on newer Immich). The key stays
  on the StartOS box; the frame never receives it. Leave the field blank to
  keep the saved key.
- **Immich album link or ID** — paste the album page link
  (`https://your-immich/albums/<id>`) or the album ID itself. If the server
  field is blank, the box derives the server from a full album link.

HTTPS on a `.local` hostname or private IP accepts a self-signed certificate,
which covers services exposed by StartOS or UmbrelOS; a public hostname needs
a valid certificate.

The box reads album metadata on its sync interval and serves every Immich
image through its own `/api/immich/photo/...` endpoint, adding the API key on
the server side. The frame therefore only talks to the StartOS box, and
Android 6 frames do not need to negotiate TLS with the Immich server directly.
Images are not copied to disk.

### Photo Album Info

A read-only summary of each configured album: its source (iCloud or Immich),
name, photo count, capture-date coverage, sync status and the last completed
sync. Run **Sync Now**, then reopen this action for the newest values.

### Edit Calendars

Add one row per calendar. The integration uses **iCalendar (ICS)** rather than
a provider-specific account connection, so any service that provides a public,
read-only ICS feed can be used:

- **Name** — the label shown on the frame.
- **URL** — a public read-only ICS link. Apple `webcal://` links are converted
  to HTTPS, and the link does not need to end in `.ics`.
- **Colour** — the calendar's colour on the frame.
- **Assigned user** — whose personal page and lane this calendar belongs to.
- **Show on Today homepage** — turn it off to keep the calendar in the
  Calendar tab but remove its events from Today.
- **School calendar** — marks the calendar for the School section. It still
  appears in the Calendar tab and on the personal page of its assigned user, or
  of users who select it in Edit Users.
- **Meal calendar** — buckets this calendar's entries into Breakfast, Lunch and
  Dinner for the Meals section. Choosing it clears **Show on Today homepage**,
  and a calendar cannot be both school and meal.

### Edit Location & Units

- **ZIP or coordinates** — the forecast location. A ZIP is resolved on the box;
  coordinates can be entered directly.
- **Label** — an optional name such as `Home`. It stays separate from the
  resolved city and state.
- **Time zone** — an IANA zone such as `America/Chicago`. Blank uses the
  server's zone.
- **Temperature unit** — Fahrenheit or Celsius.
- **Night display** — dim the dashboard after idle, optionally with red tinting
  to remove blue light.

Forecasts come from **Open-Meteo** and need no API key. Without a location, or
when the forecast cannot be fetched, Weather and Today say **Weather
unavailable** instead of showing demo data.

### Edit Users

Each row is one person shown in Today's top-right corner:

- **Name** and a **colour** picked from the same palette as Edit Calendars.
  An existing custom hex colour is offered as a **Current (#RRGGBB)** option.
- **Calendars** shown on that person's page. Calendars assigned to them in
  Edit Calendars are selected by default.
- **Cards** for their personal page: calendar, weather, photos, chores,
  groceries and home controls.

Each row also shows that person's next calendar activity from the last
completed sync. Run **Sync Now** and reopen the action to refresh it.

### Edit Chores

Each row has a title, optional emoji, routine (**morning**, **mid-day** or
**evening**), star value and an **Assigned to** choice of a configured user or
**Anyone**. Rename, reassign, add or remove rows.

Chores assigned to a user appear in that user's lane, Today ring and personal
page. Anyone chores stay up for grabs. Saved edits and removals persist;
completion marks last for the page session.

### Edit Groceries

The editor uses individual category rows with item rows inside:

- Enter an item name and choose an optional store from the dropdown.
- Toggle **Usual item** for quick picks.
- Add stores one per row. Save and reopen the action to make new stores
  available in the item dropdowns.
- Existing catalog entries load automatically, and editing them preserves the
  current shopping list.

**Use prepopulated defaults** offers editable starter categories and common
groceries. Rename, add or remove any starter row. Turning defaults off keeps
those edits saved while leaving your own categories and list untouched.
Starters are on by default, even alongside a custom catalog.

### Printer Settings

Opening this action starts a fresh LAN search; allow about 30 seconds for the
form to appear. Opening it never changes the saved printer.

- The default scan range is **`192.168.1.0/24`** (`192.168.1.1` through
  `192.168.1.254`). Enter a different private subnet under **Scan subnet** if
  the printer is on another network; save and reopen to search the new range.
- If one printer is found and no URL is saved, its name and URL are filled in.
  If several are found, choose one under **Discovered printers**.
- If nothing is found or the search fails, enter the full IPP/IPPS URL
  manually. The manual option is selected by default.
- The note below **Discovered printers** lists the URLs found by the search
  and says whether the URL below came from discovery or from your saved
  settings.
- An existing saved URL is preserved until you submit. Selecting a discovered
  result overrides the name and URL fields; choosing **Use the name and URL
  fields below** saves the fields as entered. Clear the URL to remove the
  saved printer.

**Print** on Groceries sends the open items as a grouped PDF from StartOS to
this saved printer. Store lists print side by side in columns, and each
quantity (x1, x2, and so on) sits directly beside its item. There is no browser
print dialog or printer selection on the frame. See
[Find your printer's IPP URL](#find-your-printers-ipp-url) for manual discovery
and lookup steps.

### Edit Sidebar

Show or hide each rail section. The order is fixed: Today, Weather, Calendar,
Photos, Meals, School, Chores, Groceries, Vestaboard, Home controls. Today is
always first and cannot be hidden. **Meals** and **School** start hidden and
must be turned on here; the other sections start visible. Hiding a section also
blanks its card on Today and removes its shortcut.

### Vestaboard Settings

Use this action to connect a Vestaboard on the same private network.

1. In the Vestaboard app, enable the **Local API** and copy the key it returns.
2. Open **Actions & Config → Vestaboard Settings**. Enter the board's private
   IPv4 address (for example `192.168.1.60`) or `vestaboard.local`, paste the
   Local API key, and choose **Flagship (6×22)** or **Note (3×15)**.
3. Submit. Open the **Vestaboard** rail section on the frame.

The frame loads the board's current message into the drawing grid. Tap a
letter, number, punctuation mark or color chip, then tap or drag across cells
to paint. **Undo**, **Redo**, **Clear** and **Fill** edit the grid; **Send**
posts the finished matrix through the box's Local API proxy.

The **VBML** tab composes text with left/center/right/justified horizontal
alignment and top/middle/bottom/justified vertical alignment. A template can
use `{63}`–`{70}` color codes, `{{prop}}` values and new lines. **Preview**
renders locally without sending. Advanced users can enter a full VBML JSON
payload; the box composes the supported subset locally and sends the resulting
character matrix. The Local API key stays in `config.json` and is never sent
to the frame. Only private IPv4 addresses and `.local` hosts are accepted.

### Sync Now

Requests an immediate refresh of photos, calendars and weather instead of
waiting for the next scheduled sync.

## Find your printer's IPP URL

The manual **Printer URL** field remains available in **Actions & Config →
Printer Settings**. It is intentionally not shown on the dashboard display.
Each household saves its own printer; no printer IP is hardcoded into the
package. The printer must accept PDF over IPP or IPPS.

### Try automatic discovery first

1. Connect the printer and StartOS server to your home LAN. Avoid guest Wi-Fi
   or client-isolated networks.
2. Open **Actions & Config → Printer Settings**. Opening it starts a fresh
   LAN search; allow about 30 seconds for the form to appear.
3. If exactly one printer is found and no printer is saved, its name and URL
   are filled in. If several are found, choose one under **Discovered printers**.
   If none are found or the search fails, enter the URL manually.
4. Press **Submit** to save. The Groceries **Print** button then uses that
   saved address without another search.

The visible note below **Discovered printers** reports the fresh search result
and lists the discovered IPP URLs, including their addresses. It distinguishes
rediscovering your saved URL from merely reloading it from settings, and
reports an empty or failed search. A saved URL alone is not evidence that
discovery found the printer.

Discovery combines Bonjour/DNS-SD (`_ipp._tcp` and `_ipps._tcp`) with
**direct local-subnet probing**, so multicast announcements are not required.
The default scan range is **`192.168.1.0/24`**; missing or blank subnet settings
use this range rather than detecting an internal container network. It probes
TCP **631 and 443**. Open ports alone do not qualify: it sends read-only IPP
**Get-Printer-Attributes** requests and lists only printers reporting **PDF**
and **Print-Job** support. It does not submit a print job during discovery or
automatically replace your saved printer.

Allow about **30 seconds** for a search. Scans use bounded concurrency, a
25-second probing budget and at most **1024 private IPv4 addresses**. Public,
loopback, oversized ranges and `0.0.0.0/0` are not scanned. An existing saved
printer stays in the fields even if discovery finds a different one. Selecting
a discovered result overrides those fields on Submit. Choose **Use the name
and URL fields below** to save the fields as entered. This is selected by
default and works even when discovery finds nothing. To remove a saved
printer, choose that option and clear the URL before submitting.

If your printer is on a different network, override the default range:

1. Open **Printer Settings** and enter your network in **Scan subnet
   (optional)**, for example `10.0.0.0/24`.
2. Submit/save that setting, then reopen **Printer Settings** to search it.
3. Use the network and subnet mask shown by your router. The `/24` is a
   network-prefix length, not the last IP address to search. For a large LAN,
   choose a smaller range containing the printer; the scanner rejects public
   networks and ranges over the limit.

Custom subnet settings are preserved. Clearing the field restores the
`192.168.1.0/24` default; it does not enable container-route detection.

The probe checks `/ipp/print`, `/ipp/printer`, `/printers` and `/`, with IPPS
on 443 or 631. Bonjour can supply other advertised endpoints. A printer on an
unusual port/path, behind authentication, outside the selected range, or not
advertising PDF support may still need manual setup below. A scan cannot
bypass VLAN isolation or a firewall. Do not expose printer ports to the
Internet or disable your firewall.

### Find the IP address without Bonjour

Use any of these methods:

- On the printer, open **Network / Wi-Fi / TCP/IP status**, or print its network
  configuration report. Record its IPv4 address.
- In your router's **Connected devices / DHCP clients** list, identify the
  printer by model, hostname or the MAC address printed on its label.
- On Windows, open the installed printer's **Printer properties → Ports**.
  A Standard TCP/IP port's **Configure Port** dialog shows its IP address.
  A WSD port may not show an IP; use the printer or router instead.

Open `http://<printer-ip>` or `https://<printer-ip>` in a browser. In the
printer's network settings, look for **IPP**, **AirPrint** or **Mopria** and
enable it if necessary. Use the manufacturer's documented **IPP resource
path** and port; an IP address alone is not the full printing URL. An
administration-page URL such as `/net/net/airprint.html` is not an IPP endpoint.

### Find the full URL on a Mac with Bonjour

These are the lookup steps used to identify the printer during development.
Run them in **Terminal on your Mac**, not in the StartOS container.
Copy only the command, not the Markdown backticks. These commands keep
running; after the result appears, press **Control-C** before the next step.
They only inspect announcements and do not print anything.

1. List printers advertising plain IPP:

   ```sh
   dns-sd -B _ipp._tcp local
   ```

   Copy the exact **Instance Name**, including spaces. If nothing appears,
   try `dns-sd -B _ipps._tcp local` for secure IPP. If neither finds anything,
   use the printer/router method above; Bonjour may be blocked on this network.

2. Resolve that service. Replace `Example Printer` with the instance name:

   ```sh
   dns-sd -L "Example Printer" _ipp._tcp local
   ```

   If you found it under `_ipps._tcp`, use that service type instead.
   Record the **hostname** and **port** after `can be reached at`, and the
   `rp=` value in the TXT record. For example:

   ```text
   can be reached at PRINTER123.local.:631
   rp=ipp/print
   ```

3. Resolve the advertised hostname to IPv4:

   ```sh
   dns-sd -G v4 PRINTER123.local.
   ```

   Replace `PRINTER123.local.` with the hostname from step 2—not the friendly
   instance name from step 1. Record the IPv4 address, for example
   `192.168.1.50`. A `No Such Record` result is not an address.

4. Combine the service type, IP address, advertised port and `rp` path:

   ```text
   ipp://192.168.1.50:631/ipp/print
   ```

   For `_ipps._tcp`, use `ipps://` and its advertised port, which may be
   `443` rather than `631`. Prefix `rp` with `/` if necessary. These values
   are examples: use your printer's results, not a guessed port or path.
   A `dnssd://...` URI from the Mac's printer settings is not an IPP URL.
   Prefer the numeric IP; `.local` resolution on your Mac does not guarantee
   that the StartOS service can resolve the same name.

### Save once and test

1. Open **Frame Dashboard → Actions & Config → Printer Settings** in StartOS.
2. Enter an optional friendly name and the full `ipp://` or `ipps://` URL.
3. **Submit/save the form.** Reopen it and confirm the URL is still present.
   Merely typing into the field does not save it.
4. Add an item to Groceries and press **Print**. This sends a real print job
   from StartOS; it does not open the Mac's or Android's print dialog.
5. Give the printer a **DHCP reservation** in your router so its IP does not
   change. If it changes, update the saved URL here.

If printing fails, distinguish a connection error (wrong IP/port, printer
offline, or network restriction) from an IPP error (wrong resource path,
authentication requirement, or unsupported document format). A successful
TCP connection alone does not verify the full IPP URL or PDF support.
Printer selection and URL changes remain in StartOS, not on the photo frame.

## How it works

These notes are for operators who want to understand the moving parts. Daily
use needs only the settings above.

### Weather and radar

- **Open-Meteo** supplies forecasts and current conditions; no API key. The
  dashboard turns Open-Meteo's numeric weather code into words and icons, and
  asks whether it is day or night, so a clear sky reads **Clear** with a moon
  at night and **Sunny** during the day.
- The current-condition icon uses the live weather code, and each hourly slot
  belongs to today only, so a later forecast day cannot show up as "raining
  now".
- **RainViewer** supplies the radar loop. Tiles are proxied through the box, so
  the Android 6 frame never contacts RainViewer directly.
- The radar panel shows the map immediately, then **Loading radar N%** while
  every tile in the replay loads and decodes. Playback starts only when the
  whole loop is ready.
- A prepared replay is reused on return, on a data refresh and after a zoom
  change while its metadata is fresh. Expired, failed or interrupted replays
  pass the full buffering gate again.
- The map combines labelled OpenStreetMap tiles with a transparent U.S. Census
  state/county layer, at zoom 7–10 with aligned source-z7 radar overzoom.
- Geographic and radar tiles use the box's persistent cache with conditional
  revalidation; nginx preserves the service's per-response cache headers.
- The Weather header names the forecast city/state and ZIP. It resolves the
  postal place on the box and keeps a configured label such as "Home"
  separate.

### Photos

- Sync stores metadata only. iCloud images stream from Apple's CDN; Immich
  images are proxied by the box because the frame cannot send an API key.
- The Immich API key stays in `config.json` on the box. Album manifests contain
  only relative `/api/immich/photo/<album>/<asset>?size=...` paths.
- Immich thumbnails and previews are cached by the frame for a day; assets are
  immutable, so no revalidation is needed.
- Captions use the photo's capture timestamp, not the date it was added.
  Immich uses `localDateTime` first (it preserves the photographer's local
  calendar date), then EXIF `dateTimeOriginal`, then `fileCreatedAt`; videos
  and trashed assets are skipped.

### Frame resilience

- The clock is treated as untrusted until the year is plausible, so a frame
  with no clock battery shows `--:--` instead of a confidently wrong date.
- If the box cannot be reached, the screen shows **Dashboard cannot be
  reached** instead of falling back to demo data; it clears on the next
  successful poll.
- A self-healing page reload recovers a frame left on a stale bundle after an
  update.
- Night mode dims the dashboard instead of replacing it, optionally with red
  tinting to remove blue light.
- A screen lock can pin one section or lock the frame entirely, optionally
  behind a passcode.
- The ambient photo view runs after idle, showing the clock, date, weather and
  next event over the photos. It does not show the calendar-colored people
  avatars. Static content shifts slightly to reduce burn-in.

### StartOS integration

- Runs as one container: nginx serves the dashboard and proxies `/api/` to a
  Python sync/API service.
- Configuration lives in `config.json` on the `main` volume. The service picks
  up saved changes within ten seconds and starts a new sync; no restart.
- Actions merge their own values without replacing unrelated settings.
- Supports `x86_64` and `aarch64`, with a health check on the web interface.

## Development

```sh
npm install
make x86      # type-check, format check, bundle, and pack the x86_64 s9pk
python3 -m unittest discover -s tests
```

The dashboard source lives in `upstream-project/`. The StartOS package code is
in `startos/`, the sync/API service in `service/`, and regression tests in
`tests/`.

For privacy-safe README captures, use the
[screenshot guide](tools/screenshots/README.md). Its fictional family fixture and
local photo assets are separate from the running service and never replace a
live configuration.

When a feature or bug fix ships:

1. Add its user-facing release note to `startos/versions/current.ts` (English
   only) and bump the version; a sideload will not replace an equal version.
2. Update the feature descriptions in this README.
3. Add the same release note under a new version heading in
   [CHANGELOG.md](CHANGELOG.md).

## Future versions

- **StartOS repository distribution.** Publish future releases through a StartOS
  package repository so installation and updates no longer require manually
  downloading and sideloading `.s9pk` files. Sideloading remains the current
  installation method.
- **Home integration.** Planned compatibility with both **Control4** and
  **Home Assistant**: view security cameras on the home network, see who is at
  the door, play music and control lights.
- Currently StartOS 0.4 compatible. I hope to release a version for UmbrelOS 2.0 as well.

## Credits and licensing

This project was possible thanks to the direction and original dashboard from
[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).
Start there for compatible-frame identification, ADB access, backups and kiosk
setup. The owner's submitted Dragon Touch Classic10 Charm report is included
in [docs/dragontouch-classic10-charm.md](docs/dragontouch-classic10-charm.md).

This repository vendors the upstream dashboard in `upstream-project/` and adds
the StartOS packaging, sync/API service, configuration actions and dashboard
changes described above. Upstream is licensed under the MIT License, copyright
(c) 2026 Wes Bos; its notice is preserved in
[`upstream-project/LICENSE`](upstream-project/LICENSE). This repository is also
MIT-licensed, with copyright notices for aoeu10 and Wes Bos.

The documentation's forest and mountain photographs are **not MIT-licensed**.
They are used under the [Unsplash License](https://unsplash.com/license), with
photographers, original pages and download URLs recorded in
[`tools/screenshots/photos/sources.json`](tools/screenshots/photos/sources.json).

Forecast data comes from [Open-Meteo](https://open-meteo.com/). Radar imagery
comes from [RainViewer](https://www.rainviewer.com/) and is credited on screen.
Map tiles come from OpenStreetMap contributors; the county layer comes from the
U.S. Census Bureau.
