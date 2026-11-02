import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const defaultOutput = resolve(here, '../../docs/images');

// Exported to support reuse with a Puppeteer page.
export async function capture(page, { baseUrl = 'http://127.0.0.1:8765', output = defaultOutput, weatherExample = null } = {}) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname)) {
    throw new Error('Capture only supports the local documentation fixture, not a live dashboard.');
  }
  if (weatherExample && !/^[a-z0-9-]+$/.test(weatherExample)) {
    throw new Error('Weather example name must contain lowercase letters, digits or hyphens.');
  }
  const errors = [];
  const onError = error => errors.push(String(error));
  page.on('pageerror', onError);
  try {
    await mkdir(output, { recursive: true });
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    const runtime = await page.evaluate(async () => {
      const response = await fetch('/demo/runtime.json');
      if (!response.ok) throw new Error('Not the isolated documentation fixture');
      return response.json();
    });
    if (runtime.weatherLocationPreset && !weatherExample) {
      throw new Error('Use --weather-example NAME with a location preset to preserve the Boise gallery.');
    }
    await page.emulateTimezone(runtime.timezone);
    await page.evaluate(() => localStorage.removeItem('hq.lock.v1'));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.Server?.online && DATA.users?.length === 4);
    await page.evaluate(sceneTime => {
      App.now = () => App.date(sceneTime);
      App.idle.home = App.idle.ambient = 1000000;
      App.emit('time');
      App.emit('minute', App.now());
      App.rerender();
    }, runtime.sceneTime);
    await page.evaluate(() => document.fonts.ready);

    async function go(view) {
      await page.evaluate(view => { App.setMode('day'); App.go(view); }, view);
      await page.waitForFunction(view => App.current === view && document.querySelector('#view-' + view)?.classList.contains('is-active'), {}, view);
    }
    async function settled() {
      await page.waitForFunction(() => !document.querySelector('#toasts .toast'), { timeout: 15000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const images = Array.from(document.images).filter(image => image.closest('.view.is-active, #ambient'));
        await Promise.all(images.map(image => image.decode()));
        const transitions = document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity);
        await Promise.all(transitions.map(animation => animation.finished.catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
    }
    const shots = [];
    async function shot(file, description, { keepToast = false } = {}) {
      if (!keepToast) await settled();
      const bytes = await page.screenshot({ path: resolve(output, file), type: 'png' });
      const state = await page.evaluate(() => ({ view: App.current, mode: App.mode,
        red: document.querySelector('#stage').dataset.red === '1',
        lock: JSON.parse(localStorage.getItem('hq.lock.v1') || '{}'),
        radarTime: document.querySelector('#view-weather .wx-radar-time')?.textContent || null,
        radarTile: document.querySelector('#view-weather .wx-tile')?.style.backgroundImage || null }));
      delete state.lock.hash;
      shots.push({ file, description, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), ...state });
      console.log('Captured ' + file);
    }
    async function hold(selector, milliseconds) {
      const element = await page.$(selector);
      const box = await element.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await new Promise(resolve => setTimeout(resolve, milliseconds));
      await page.mouse.up();
    }
    async function passcode() {
      for (const digit of runtime.fixture.demoPasscode) await page.click('#lockPad [data-k="' + digit + '"]');
      await page.click('#lockPad [data-k="ok"]');
    }

    let radarMetadata = null;
    async function captureWeather() {
      const stem = 'frame-weather' + (weatherExample ? '-' + weatherExample : '');
      const location = runtime.fixture.location.name;
      await go('weather');
      await page.waitForFunction(() => document.querySelector('#view-weather .wx-radar')?.getAttribute('aria-busy') === 'false', { timeout: 180000 });
      await page.waitForFunction(() => document.querySelector('#view-weather .wx-map-status')?.hidden, { timeout: 60000 });
      const radarTime = await page.$eval('#view-weather .wx-radar-time', element => element.textContent);
      if (/loading|unavailable/i.test(radarTime)) throw new Error(radarTime);
      radarMetadata = await page.evaluate(async () => {
        const response = await fetch('/api/radar');
        if (!response.ok) throw new Error('Radar metadata unavailable');
        return response.json();
      });
      if (weatherExample && !radarMetadata.frames.some(frame => frame.echo === true)) {
        throw new Error('No verified regional precipitation echoes; choose a wetter location or capture later.');
      }
      await shot(stem + '.png', location + ' forecast and real regional precipitation overlay');
      await page.click('#view-weather [data-map-zoom="1"]');
      await page.waitForFunction(() => document.querySelector('#view-weather .wx-map-status')?.hidden, { timeout: 60000 });
      await shot(stem + '-local.png', location + ' precipitation overlay zoomed to local geographic context');
    }
    async function saveReport() {
      if (errors.length) throw new Error('Dashboard runtime errors: ' + errors.join('\n'));
      const report = { capturedAt: new Date().toISOString(), viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
        sceneTime: runtime.sceneTime, timezone: runtime.timezone, weatherFetchedAt: runtime.weatherFetchedAt,
        location: runtime.fixture.location, weatherLocationPreset: runtime.weatherLocationPreset || null,
        fixtureSha256: createHash('sha256').update(await readFile(resolve(here, 'family.json'))).digest('hex'),
        notes: 'Fictional family and calendar. Real weather/radar for ' + runtime.fixture.location.name + '. Local credited Unsplash photos. No live StartOS configuration or printers used.',
        radarMetadata, screenshots: shots };
      const filename = weatherExample ? 'capture-weather-' + weatherExample + '.json' : 'capture.json';
      await writeFile(resolve(output, filename), JSON.stringify(report, null, 2) + '\n');
      return report;
    }
    if (weatherExample) {
      await captureWeather();
      return await saveReport();
    }

    // Complete chores through the real controls rather than painting checkmarks.
    await go('tasks');
    for (const [routine, file] of [['morning', 'frame-chores-morning.png'], ['after', 'frame-chores.png'], ['evening', 'frame-chores-evening.png']]) {
      await page.click('#view-tasks [data-r="' + routine + '"]');
      for (const chore of runtime.fixture.chores.filter(chore => chore.r === routine && chore.completed)) {
        await page.click('#view-tasks [data-ch="' + chore.id + '"]');
        await page.waitForSelector('#view-tasks [data-ch="' + chore.id + '"].is-done');
      }
      await shot(file, routine + ' chores with simulated completions for all four family members');
    }
    await page.click('#view-tasks [data-r="after"]');
    await go('home');
    await shot('frame-today.png', 'Today: family activities, next event, weather, photos, partially completed chores, groceries');

    await go('calendar');
    for (const [mode, file] of [['day', 'frame-calendar.png'], ['3day', 'frame-calendar-3day.png'], ['week', 'frame-calendar-week.png'], ['month', 'frame-calendar-month.png']]) {
      await page.click('#view-calendar [data-mode="' + mode + '"]');
      if (mode !== 'month') {
        // Include the lunchtime and afternoon plans instead of an empty morning.
        await page.evaluate(() => { const scroll = document.querySelector('#view-calendar .grid-scroll'); if (scroll) scroll.scrollTop = 400; });
      }
      await shot(file, mode + ' calendar view with Dad, Mom, John (6), and Susan (2)');
    }

    await go('shopping');
    for (const [store, file] of [['Boise Co-op', 'frame-groceries-coop.png'], ['Costco', 'frame-groceries-costco.png']]) {
      await page.click('#view-shopping [data-store="' + store + '"]');
      await shot(file, store + ' grocery list and selected catalog items');
    }
    await page.click('#view-shopping [data-all]');
    await shot('frame-groceries.png', 'All groceries with both store assignments and quantities');

    await go('user-dad');
    await shot('frame-person.png', "Dad's personal page: remaining-day summary, agenda, weather, photo and chores");

    await page.evaluate(() => App.setNav(DATA.nav.map(n => n.section === 'meals' ? { section: 'meals', visible: true } : n)));
    await go('meals');
    await shot('frame-meals.png', 'Meals today: Breakfast, Lunch and Dinner from the meal calendar');
    await page.click('#view-meals [data-mode="3day"]');
    await shot('frame-meals-3day.png', 'Meals 3 Day view: one column per day starting today');
    await page.click('#view-meals [data-mode="week"]');
    await shot('frame-meals-week.png', 'Meals Week view: seven days of breakfast, lunch and dinner');

    await page.evaluate(() => App.setNav(DATA.nav.map(n => n.section === 'school' ? { section: 'school', visible: true } : n)));
    await go('school');
    await shot('frame-school.png', 'School today: agenda and next activities from the school calendar');
    await page.click('#view-school [data-mode="3day"]');
    await shot('frame-school-3day.png', 'School 3 Day view');
    await page.click('#view-school [data-mode="week"]');
    await shot('frame-school-week.png', 'School Week view');
    await page.click('#view-school [data-mode="month"]');
    await shot('frame-school-month.png', 'School Month view with school activities only');

    // Restore the default hidden Meals/School sections for the remaining shots.
    await page.evaluate(() => App.setNav(DATA.nav));
    await go('photos');
    await page.click('#view-photos [data-layout="cover"]');
    const photoCount = await page.evaluate(() => DATA.photos.length);
    for (let i = 0; i < photoCount; i++) {
      if (await page.$eval('#view-photos .ph-stage .slide:last-child', slide => slide.classList.contains('slide--cover'))) break;
      await page.click('#view-photos .ph-zone--r[data-next]');
    }
    await shot('frame-photos.png', 'Full-screen forest or mountain photo in Cover layout');
    await page.click('#view-photos [data-layout="collage"]');
    await shot('frame-photos-collage.png', 'Forest and mountain photos in Collage layout');
    await page.click('#view-photos [data-layout="polaroid"]');
    await shot('frame-photos-polaroid.png', 'Polaroid photo layout');

    await go('home');
    await page.evaluate(() => { App.idle.ambient = 1; App.resetIdle(); });
    await page.waitForFunction(() => App.mode === 'ambient', { timeout: 5000 });
    await page.evaluate(() => { App.idle.ambient = 1000000; });
    // Wait for a landscape photo in the real slideshow, not a retouched crop.
    await page.waitForSelector('#ambient .slide--cover.is-in', { timeout: (photoCount + 1) * 14000 });
    await shot('frame-screensaver.png', 'Photo screensaver reached through the real idle transition');
    await go('home');
    await page.evaluate(() => App.setMode('night'));
    await page.waitForSelector('#stage[data-mode="night"][data-red="1"]');
    await shot('frame-night-red.png', 'Actual dimmed red-light night mode; image has not been brightened');

    await go('home');
    await hold('#railLock', 1400);
    await page.waitForSelector('#lkPin');
    await shot('frame-lock-options.png', 'Screen lock options: pin a section, lock entirely, or set a passcode');
    await page.click('#lkPin');
    await page.waitForSelector('#stage.is-locked-section');
    await shot('frame-lock-pinned.png', 'Today pinned while touches within Today remain enabled', { keepToast: true });
    await hold('#railLock', 1400);
    await page.waitForFunction(() => !App.lock.active());
    await settled();
    await hold('#railLock', 1400);
    await page.click('#lkPass');
    await page.waitForSelector('#lockPad');
    await passcode();
    await passcode();
    await page.waitForFunction(() => !document.querySelector('#lockPad'));
    await settled();
    await hold('#railLock', 1400);
    await page.click('#lkFull');
    await page.waitForSelector('#stage.is-locked-full #lockShield');
    await shot('frame-lock.png', 'Entire screen locked: one bottom hint line, padlock still tappable');
    await hold('#railLock', 1600);
    await page.waitForSelector('#lockPad');
    await shot('frame-lock-passcode.png', 'Passcode keypad for unlocking the frame');
    await passcode();
    await page.waitForFunction(() => !App.lock.active());

    await captureWeather();
    return await saveReport();
  } finally {
    page.off('pageerror', onError);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const index = process.argv.indexOf('--weather-example');
    const weatherExample = index < 0 ? null : process.argv[index + 1];
    if (index >= 0 && !weatherExample) throw new Error('--weather-example requires a name, such as seattle');
    const report = await capture(page, { weatherExample });
    console.log('Saved ' + report.screenshots.length + ' screenshots to ' + defaultOutput);
  } finally {
    await browser.close();
  }
}
