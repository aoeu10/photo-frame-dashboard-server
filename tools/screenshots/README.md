# Dashboard documentation screenshots

This directory is a **documentation-only demo**, not a StartOS configuration
backup or an application fallback. It serves the real built dashboard with a
fictional family and never reads the running service's data volume.

## Reusable household

Edit [`family.json`](family.json) to reuse or change the demo:

- **Dad** and **Mom** have their own calendars and personal-page cards.
- **John is 6**: first grade, soccer, swimming, reading and simple chores.
- **Susan is 2**: playgroup, storytime, naps and small tasks with adult help.
- Every person has morning, mid-day and evening chores. `completed: true` tells
  the capture script which chores to check off through the actual controls.
- **Boise Co-op** and **Costco** have separate grocery selections and quantities.
- Boise, Idaho uses **43.6150, -116.2023**, ZIP **83702**, `America/Boise` and
  Fahrenheit.
- **Meals** has breakfast, lunch and dinner examples for seven days.
- **School** uses a fictional Lincoln Elementary calendar with first grade,
  music, library, Spirit day, a field trip and a parent conference.

Calendar dates are generated relative to the server's current Boise date.
`today` supplies a busy example day; `weekly` uses Python weekday numbers
(**0 = Monday, 6 = Sunday**); `special.day` is a relative day offset. Weekly
activities fill the surrounding month, not just the screenshot's visible week.
For a busy Today screenshot, start the server during Boise's daytime: the demo
activities run from 8:30 AM through 8 PM.

The capture freezes the dashboard's displayed clock at the server startup time
for consistency across images. It does **not** change the computer's clock,
weather responses or radar timestamps. The forecast is fetched from Open-Meteo
at startup; radar, basemap and boundaries use the production service's real
proxy functions. No artificial precipitation is added when Boise is dry.

## Run and capture

Requirements: Docker, Node.js 22.12 or newer, npm and internet access for the
weather/radar/map/font services and the initial Chromium download.

From the repository root, build the actual dashboard and a local runtime image:

```sh
npm --prefix upstream-project ci
npm --prefix upstream-project run build
docker build -t frame-dashboard:screenshot-demo .
```

In the first terminal, start the isolated fixture server:

```sh
docker run --rm --name frame-dashboard-screenshot-demo \
  -p 127.0.0.1:8765:8765 \
  -v "$PWD:/workspace:ro" \
  --entrypoint python3 \
  frame-dashboard:screenshot-demo \
  /workspace/tools/screenshots/serve.py --host 0.0.0.0
```

Wait for **Screenshot fixture ready**, then open <http://127.0.0.1:8765> to
inspect it manually. In a second terminal, from the same repository root:

```sh
npm --prefix tools/screenshots ci
npm --prefix tools/screenshots run capture
```

The capture starts its own disposable headless Chromium browser. It uses the
real controls to complete chores, switch calendar and store tabs, change photo
layouts, pin Today, set a demo passcode, lock the screen and unlock it again.
Screensaver capture uses the real idle transition; red night mode uses the
application's own mode API and the fixture's enabled red-night preference.
No screenshot is brightened or otherwise retouched.

Stop the owned demo container when finished:

```sh
docker stop frame-dashboard-screenshot-demo
```

Rebuild the frontend after changing dashboard source. Restart the fixture server
after editing `family.json` or the photo manifest. A fresh capture resets its own
browser's lock state and chore completions before replaying the scenario.

For Python development without Docker, `serve.py` also runs with Python 3.9+
and Pillow installed; it uses a temporary cache directory and binds to
`127.0.0.1` by default.

## Additional rainy-region example: Seattle

The saved [`weather-seattle.json`](weather-seattle.json) preset changes only the
isolated demo's location and time zone. It does not change `family.json`, the
Boise screenshots or any live StartOS setting.

After building the runtime image above and stopping the original demo container,
start a separate Seattle scene:

```sh
docker run --rm --name frame-dashboard-seattle-example \
  -p 127.0.0.1:8765:8765 \
  -v "$PWD:/workspace:ro" \
  --entrypoint python3 \
  frame-dashboard:screenshot-demo \
  /workspace/tools/screenshots/serve.py --host 0.0.0.0 \
  --weather-location /workspace/tools/screenshots/weather-seattle.json
```

In another terminal:

```sh
npm --prefix tools/screenshots run capture -- --weather-example seattle
docker stop frame-dashboard-seattle-example
```

This captures only the two Seattle weather views, saving
`frame-weather-seattle.png`, `frame-weather-seattle-local.png` and
`capture-weather-seattle.json`. It preserves the main 30-image gallery and
its `capture.json`. The additional report records the location, time zone,
provider frame metadata, rendered radar tile and image hashes.

The weather-example mode requires verified regional radar echoes. If Seattle is
dry throughout the replay, capture later or provide a location/time-zone JSON
preset for another wet region and use a distinct example name. A point forecast
of **0 mm** at the city marker does not contradict rain elsewhere on the map or
in the earlier frames of the last-two-hours replay. Never add artificial rain.

## Output

The main capture produces **30 dashboard PNGs**; the Seattle example adds **2**,
for **32 generated dashboard images** in
[`../../docs/images/`](../../docs/images/), all at **1280 × 800** with device
scale factor 1. The root README embeds them in collapsible galleries. This
count excludes the separately supplied StartOS administration screenshots.
[`capture.json`](../../docs/images/capture.json) records the scene time, weather
fetch time, fixture SHA-256, screen modes, lock states and each PNG's SHA-256.
The current gallery preserves the earlier captures outside Meals and School.
Its `mealsSchoolCapture` metadata records the separate scene time, weather
fetch time and fixture hash for those seven refreshed images; `calendarMode`
on their image records identifies the selected Today, 3 Day, Week or Month tab.
The capture fails rather than accepting an unloaded/unavailable radar or map,
broken visible photos, or dashboard JavaScript errors.

| Group | Captures |
| --- | --- |
| Today | Family overview |
| Weather | Boise and Seattle regional radar and closer local maps |
| Calendar | Today, 3 Day, Week, Month |
| Meals | Today, 3 Day, Week, grouped into Breakfast, Lunch and Dinner |
| School | Today, 3 Day, Week, Month, with all-day and timed activities |
| Chores | Morning, Mid-Day, Evening, with partial completion |
| Groceries | Boise Co-op, Costco, All |
| Personal page | Dad's agenda, summary, weather, photos and chores |
| Photos | Cover, Collage, Polaroid |
| Idle display | Photo screensaver and red-light night mode |
| Locking | Options, pinned Today, full lock, unlock passcode keypad |

These captures do not fake the StartOS management UI. The root README also
includes **11 separately supplied StartOS screenshots**: two Actions & Config
captures and nine individual settings forms. They keep their supplied
resolutions and are not generated by this fixture or included in its capture
reports. The Actions & Config images show package **1.2.73:0**.

The published `startos-location.png` has its location name, ZIP code, latitude,
longitude and time zone irreversibly blanked for privacy, with image metadata
removed. The published `startos-printer.png` also has its printer identity,
address and subnet irreversibly blanked, with image metadata removed. Neither
unredacted source is stored in the repository. The other supplied StartOS
screenshots are unchanged.
No hardware backlight measurement or physical-frame colour calibration is
implied by the browser's red-mode image.

## Isolation and credentials

- The source checkout is mounted **read-only**. The demo's config, weather/map
  cache and grocery edits live only in the disposable container or memory.
- The production sync loop is never started: no real calendar or iCloud links
  are fetched, and no live family settings are changed.
- Printer discovery endpoints are not exposed. Printing and all POST requests
  except the in-memory grocery-list update return **403**.
- The fixture server is published only on the computer's loopback interface.
  The capture also refuses non-loopback URLs and requires the demo runtime
  endpoint before interacting with the dashboard.
- **1234 is a disposable demo passcode**, deliberately public in the fixture.
  Never reuse it for a real dashboard. Browser storage is confined to the
  disposable capture browser; no real passcode is recorded in `capture.json`.

## Photo sources and license

Six resized local JPEGs are saved in [`photos/`](photos/) so the same demo album
can be used again without relying on a random image service or an iCloud album.
[`photos/sources.json`](photos/sources.json) preserves the source pages, original
download URLs, photographer names and locations. Sharing labels in the demo
album are fictional; the real photographers are credited below. Original
capture dates are unknown and are intentionally not invented.

These photographs are covered by the [Unsplash License](https://unsplash.com/license),
**not this repository's MIT source-code license**. Unsplash permits downloading,
copying, modifying, distributing and displaying the images, including commercial
use; selling unmodified images or compiling a competing image service is not
permitted.

| Local file | Photographer | Original photo |
| --- | --- | --- |
| `snoqualmie.jpg` | Dave Hoefler | [Mt. Si and forest lake](https://unsplash.com/photos/forest-lake-near-on-mountain-4Pzn4SBYKIg) |
| `forest-road.jpg` | m c | [Misty mountain forest road](https://unsplash.com/photos/misty-mountain-forest-with-a-winding-road-cEjAmTnarso) |
| `bamboo-forest.jpg` | Fenghua | [Lush green forest](https://unsplash.com/photos/lush-green-forest-with-bamboo-in-the-foreground-RA8xFmOBN8I) |
| `snowy-peaks.jpg` | Antony Sklivagkos | [Creamy Mountains](https://unsplash.com/photos/mountain-peak-under-blue-sky-iTYShprNeRE) |
| `dolomites.jpg` | Jacek Dylag | [Mountain Peak](https://unsplash.com/photos/photo-of-gray-mountain-peak-fdPoQ3kbePU) |
| `alpine-ranges.jpg` | Fabrizio Conti | [Mountain ranges](https://unsplash.com/photos/mountain-ranges-9XWYMuECV3s) |

Forecasts: [Open-Meteo](https://open-meteo.com/). Radar:
[RainViewer](https://www.rainviewer.com/). Map: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Boundaries: [U.S. Census Bureau](https://www.census.gov/). Their production
on-screen credits remain visible in the weather screenshots.
