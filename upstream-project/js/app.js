import { TZDate } from '@date-fns/tz';

// Core shell: router, clock, idle/ambient, toasts, sheets, helpers.
(function () {
  'use strict';
  var D = window.DATA;
  var App = window.App = { state: D, views: {}, current: null, mode: 'day' };
  var $ = App.$ = function (s, r) { return (r || document).querySelector(s); };
  App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ------------------------------------------------------------ events
  var handlers = {};
  App.on = function (e, fn) { (handlers[e] = handlers[e] || []).push(fn); };
  App.emit = function (e, a) { (handlers[e] || []).forEach(function (fn) { fn(a); }); };

  // Dates retain their absolute timestamp; local getters/setters use the configured zone.
  var timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  App.date = function () {
    var args = Array.prototype.slice.call(arguments);
    if (!args.length) args.push(Date.now());
    return TZDate.tz.apply(TZDate, [timeZone].concat(args));
  };
  App.setTimeZone = function (zone) {
    if (!zone || zone === timeZone) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).format();
    } catch (e) {
      return false; // unknown zone: keep rendering with the current one
    }
    timeZone = zone;
    lastMin = -1;
    App.emit('time');
    return true;
  };
  App.now = function () { return App.date(); };
  App.dayStart = function (d) { var x = App.date(d); x.setHours(0, 0, 0, 0); return x; };
  App.addDays = function (d, n) { var x = App.date(d); x.setDate(x.getDate() + n); return x; };
  App.sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  // Untrusted clock: an implausible boot time must not pick the dim night
  // display at midday, so treat it as day until the clock is plausible.
  App.isNight = function () {
    if (!App.clockTrusted()) return false;
    var h = App.now().getHours();
    return h >= 22 || h < 6;
  };

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  App.fmt = {
    time: function (d, ampm) {
      var h = d.getHours(), m = d.getMinutes();
      var s = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
      return ampm === false ? s : s + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    // "4 PM", "3:45 PM"
    hour: function (d) {
      var h = d.getHours(), m = d.getMinutes();
      return (h % 12 || 12) + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    ampm: function (d) { return d.getHours() >= 12 ? 'PM' : 'AM'; },
    range: function (a, b) {
      var same = App.fmt.ampm(a) === App.fmt.ampm(b);
      return (same ? App.fmt.time(a, false) : App.fmt.time(a)) + ' – ' + App.fmt.time(b);
    },
    day: function (d) { return DAYS[d.getDay()]; },
    dayShort: function (d) { return DAYS[d.getDay()].slice(0, 3); },
    month: function (d) { return MONTHS[d.getMonth()]; },
    monthShort: function (d) { return MON_SHORT[d.getMonth()]; },
    mins: function (m) {
      m = Math.max(0, Math.round(m));
      if (m < 60) return m + ' min';
      var h = Math.floor(m / 60), r = m % 60;
      return h + ' hr' + (r ? ' ' + r + ' min' : '');
    },
    rel: function (d) {
      var t = App.dayStart(App.now()), x = App.dayStart(d), diff = Math.round((x - t) / 864e5);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      return DAYS[d.getDay()];
    }
  };
  App.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // Android 6's emoji font predates most emoji: flags, ZWJ sequences and skin
  // tones render as boxes in calendar titles. Strip pictographs and dingbats
  // while keeping ordinary text symbols. Adapted from
  // wellavelino/frameo-homeassistant-dashboard `cleanTitle` (MIT).
  var EMOJI = (function () {
    try {
      return new RegExp('[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{200D}]', 'gu');
    } catch (e) {
      // Older engine without the u flag: strip surrogate pairs (astral emoji).
      return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    }
  })();
  App.cleanTitle = function (s) {
    if (s == null) return '';
    var cleaned = String(s).replace(EMOJI, '').replace(/\s+/g, ' ').trim();
    // A title that was only emoji would otherwise become a blank event block.
    if (!cleaned) {
      cleaned = String(s).replace(/\s+/g, ' ').trim();
    }
    return cleaned;
  };

  // ------------------------------------------------------------ icons + people
  App.icon = function (name, size, cls) {
    size = size || 24;
    return '<svg class="i ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.ICONS[name] || '') + '</svg>';
  };
  App.person = function (id) {
    if (id === 'family' || id === 'any') return D.family;
    for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i];
    var school = D.schoolPeople || [];
    for (var s = 0; s < school.length; s++) {
      if (school[s].id === id || school[s].name.toLowerCase() === String(id).toLowerCase()) return school[s];
    }
    var users = D.users || [];
    for (var j = 0; j < users.length; j++) {
      if (users[j].id === id || users[j].name.toLowerCase() === String(id).toLowerCase()) return users[j];
    }
    return D.family;
  };
  App.pstyle = function (p) {
    if (typeof p === 'string') p = App.person(p);
    return '--c:' + p.color + ';--c-rgb:' + p.rgb + ';--c-ink:' + p.ink;
  };
  App.avatar = function (p, size, cls) {
    if (typeof p === 'string') p = App.person(p);
    size = size || 48;
    return '<span class="avatar ' + (cls || '') + '" style="' + App.pstyle(p) + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px">' + (p.id === 'family' ? '★' : App.esc(p.name[0] || '')) + '</span>';
  };
  App.dots = function (ids, size) {
    return '<span class="dots">' + ids.map(function (id) { return '<i style="' + App.pstyle(id) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '"></i>'; }).join('') + '</span>';
  };

  // ------------------------------------------------------------ calendar helpers
  App.events = function () { return D.events.slice(); };
  App.isFamily = function (e) { return e.people.indexOf('family') > -1 || (D.people.length > 1 && D.people.every(function (p) { return e.people.indexOf(p.id) > -1; })); };
  App.evColor = function (e) { return App.isFamily(e) ? D.family : App.person(e.people[0]); };
  App.timedOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return !ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  };
  App.allDayOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    });
  };
  App.leaveBy = function (e) { return e.travel ? App.date(+e.start - e.travel * 60000) : e.start; };
  // The next thing someone needs to act on: earliest upcoming "leave by" today.
  // Omit keys to use every calendar; pass an empty array to select none.
  App.nextEvent = function (keys) {
    var now = App.now();
    var list = App.timedOn(now).filter(function (e) {
      if (e.start <= now) return false;
      if (keys && !keys.length) return false;
      if (!keys) return true;
      return e.people.some(function (id) { return keys.indexOf(id) > -1; });
    });
    list.sort(function (a, b) { return App.leaveBy(a) - App.leaveBy(b); });
    return list[0] || null;
  };
  App.findEvent = function (id) {
    return App.events().filter(function (e) { return e.id === id; })[0];
  };

  // ------------------------------------------------------------ chores + weather helpers
  // Configured users own chores; Anyone is always last. Without server users
  // (demo/offline), fall back to the demo household.
  App.choreLanes = function () {
    var who = Array.isArray(D.users) ? D.users.map(function (u) { return u.id; }) : D.people.map(function (p) { return p.id; });
    return who.concat(['any']);
  };
  App.currentRoutine = function () {
    var h = App.now().getHours();
    for (var i = 0; i < D.routines.length; i++) if (h >= D.routines[i].from && h < D.routines[i].to) return D.routines[i];
    return D.routines[2];
  };
  App.hasWeather = function () {
    return !!(D.weather && D.weather.t && D.weather.t.length);
  };
  App.weatherNow = function () {
    if (!App.hasWeather()) return null;
    var W = D.weather, h = App.now().getHours(), n = W.now || {};
    var temp = n.temp != null ? n.temp : W.t[h];
    var cond = n.c != null ? n.c : W.c[h];
    var rainAt = -1;
    for (var i = h; i < 24; i++) if (W.p[i] >= 50) { rainAt = i; break; }
    var summary, advice;
    if (rainAt === h) {
      var stop = h; while (stop < 24 && W.p[stop] >= 50) stop++;
      summary = 'Rain until ' + App.fmt.hour(App.date(2000, 0, 1, stop));
      advice = 'Umbrella weather';
    } else if (rainAt > -1) {
      summary = 'Rain from ' + App.fmt.hour(App.date(2000, 0, 1, rainAt));
      var soccer = App.timedOn(App.now()).filter(function (e) { return /soccer/i.test(e.title) && e.start > App.now(); })[0];
      advice = soccer ? 'Pack a rain jacket for soccer' : 'Grab a rain jacket';
    } else {
      summary = W.t[h] < 12 ? 'Clear and cool' : 'Dry all day';
      advice = W.t[h] < 12 ? 'Jacket weather' : 'Light layers';
    }
    var labels = { sun: 'Sunny', moon: 'Clear', partly: 'Partly cloudy', cloud: 'Overcast', rain: 'Rain' };
    return { temp: temp, cond: cond, label: labels[cond], hi: W.hi, lo: W.lo, summary: summary, advice: advice, hour: h };
  };
  App.hourly = function (count) {
    if (!App.hasWeather()) return [];
    var W = D.weather, h = App.now().getHours(), out = [];
    for (var i = 0; i < count; i++) {
      var x = (h + i) % 24;
      out.push({ h: x, t: W.t[x], c: W.c[x], p: W.p[x], label: i === 0 ? 'Now' : ((x % 12 || 12) + (x >= 12 ? 'p' : 'a')) });
    }
    return out;
  };

  // ------------------------------------------------------------ router
  App.register = function (name, view) { App.views[name] = view; };
  // Apply the configured sidebar order and visibility. Sections omitted from
  // the list are hidden; hidden sections stay reachable from Today cards.
  App.setNav = function (nav) {
    if (!Array.isArray(nav) || !nav.length) return;
    var rail = $('#rail'), clock = $('#railClock');
    var buttons = {};
    App.$$('.rail-item', rail).forEach(function (b) { buttons[b.dataset.go] = b; });
    App.$$('.rail-item', rail).forEach(function (b) { b.hidden = true; });
    nav.forEach(function (item) {
      var b = buttons[item.section];
      if (!b) return;
      b.hidden = item.visible === false;
      rail.insertBefore(b, clock);
    });
    App.$$('.rail-item', rail).forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.go === App.current);
    });
  };
  // Whether a section is shown in the configured sidebar. Sections omitted
  // from the saved list are hidden; no saved list means every section is on.
  App.sectionVisible = function (name) {
    var nav = D.nav;
    if (!Array.isArray(nav) || !nav.length) return true;
    for (var i = 0; i < nav.length; i++) {
      if (nav[i] && nav[i].section === name) return nav[i].visible !== false;
    }
    return false;
  };
  // Views are built once and kept laid out (hidden with content-visibility), so switching tabs
  // only has to paint. A view is rebuilt when its data changed ('data'/'time' events) or, for
  // time-sensitive views (minutely: true), when the minute has rolled over since it was built.
  function minuteKey() { return Math.floor(App.now().getTime() / 60000); }
  function build(name, opts) {
    var view = App.views[name];
    view.show($('#view-' + name), opts || {});
    view._built = true; view._dirty = false; view._min = minuteKey();
  }
  App.go = function (name, opts) {
    opts = opts || {};
    // While locked, navigation is gated to the locked section — but the very
    // first go (nothing active yet) must land somewhere, or the boot is blank.
    if (App.lock && App.lock.active() && App.current && !App.lock.allows(name)) return;
    if (!App.views[name]) name = 'home';
    if (App.current && App.current !== name && App.views[App.current] && App.views[App.current].hide) App.views[App.current].hide();
    App.$$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
    App.$$('.rail-item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.go === name); });
    App.current = name;
    var view = App.views[name];
    if (!view._built || view._dirty || opts.rerender || (view.minutely && view._min !== minuteKey())) build(name, opts);
    else if (view.resume) view.resume($('#view-' + name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  };
  // Build a hidden view and lay it out now (cached by content-visibility; no paint happens).
  function prebuild(name) {
    var el = $('#view-' + name), view = App.views[name];
    build(name);
    if (view.hide) view.hide();
    el.classList.add('is-warming');
    el.offsetHeight;
    el.classList.remove('is-warming');
  }
  // Pre-build (startup) and re-build (after data changes) hidden views in the background, one per
  // slot, so navigating to them never pays the rebuild cost.
  var refreshTimer = null;
  function refreshStale(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function next() {
      var name = Object.keys(App.views).filter(function (k) {
        var v = App.views[k];
        return k !== App.current && (!v._built || v._dirty);
      })[0];
      if (!name) return;
      prebuild(name);
      refreshTimer = setTimeout(next, 400);
    }, delay);
  }
  function markStale() {
    Object.keys(App.views).forEach(function (k) { if (k !== App.current) App.views[k]._dirty = true; });
    refreshStale(1500);
  }
  App.on('data', markStale);
  App.on('time', markStale);
  App.rerender = function () {
    if (App.current) App.views[App.current].show($('#view-' + App.current), { rerender: true });
  };

  // ------------------------------------------------------------ toasts (single, with undo)
  var toastTimer;
  App.toast = function (html, opts) {
    opts = opts || {};
    var box = $('#toasts');
    box.innerHTML = '';
    clearTimeout(toastTimer);
    var ms = opts.ms || 5000;
    var t = document.createElement('div');
    t.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
    t.style.setProperty('--ms', ms + 'ms');
    t.innerHTML = (opts.icon ? App.icon(opts.icon, 26) : '') + '<span class="toast-msg">' + html + '</span>' +
      (opts.undo ? '<button class="toast-undo">' + App.icon('undo', 22) + 'Undo</button>' : '');
    box.appendChild(t);
    t.classList.add('is-in');
    function kill() { t.remove(); }
    toastTimer = setTimeout(kill, ms);
    if (opts.undo) t.querySelector('.toast-undo').addEventListener('click', function () { clearTimeout(toastTimer); opts.undo(); kill(); });
  };

  // ------------------------------------------------------------ sheets (modal cards)
  App.sheet = function (html, opts) {
    opts = opts || {};
    var layer = $('#sheetLayer');
    layer.innerHTML = '<div class="sheet-scrim"></div><div class="sheet ' + (opts.cls || '') + '">' +
      '<button class="sheet-x" data-close aria-label="Close">' + App.icon('x', 28) + '</button>' + html + '</div>';
    layer.classList.add('is-open');
    function close() {
      if (!layer.classList.contains('is-open')) return;
      layer.classList.remove('is-open');
      if (opts.onClose) opts.onClose();
      layer.innerHTML = '';
    }
    App.closeSheet = close;
    layer.querySelector('.sheet-scrim').addEventListener('click', close);
    App.$$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', close); });
    if (opts.onMount) opts.onMount(layer.querySelector('.sheet'), close);
    return close;
  };
  App.closeSheet = function () {};

  // Stage-local coordinates for an element's center (stage may be scaled on desktop)
  App.centerOf = function (el) {
    var stage = $('#stage').getBoundingClientRect(), r = el.getBoundingClientRect(), k = stage.width / 1280;
    return { x: (r.left + r.width / 2 - stage.left) / k, y: (r.top + r.height / 2 - stage.top) / k };
  };

  // ------------------------------------------------------------ press-and-hold
  App.hold = function (el, ms, cb) {
    var t = null;
    el.style.setProperty('--hold', ms + 'ms');
    el.addEventListener('pointerdown', function () {
      if (cb.enabled && !cb.enabled()) return;
      el.classList.add('is-holding');
      t = setTimeout(function () { t = null; el.classList.remove('is-holding'); cb.done(); }, ms);
    });
    function cancel(e) {
      if (!t) return;
      clearTimeout(t); t = null;
      el.classList.remove('is-holding');
      if (cb.cancel && e.type === 'pointerup') cb.cancel();
    }
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  };

  // ------------------------------------------------------------ modes: day / ambient / night
  App.setMode = function (m) {
    var stage = $('#stage');
    App.mode = m;
    stage.dataset.mode = m;
    if (m === 'night' && App.nightRed) stage.dataset.red = '1';
    else stage.removeAttribute('data-red');
    App.emit('mode', m);
  };

  // Optional red night tint: removes blue light. Set from StartOS config.
  App.nightRed = false;
  // Whether the frame dims the dashboard after idle at night. When off, it goes
  // to the ambient photo view instead.
  App.nightDim = true;
  App.setNightDisplay = function (opts) {
    opts = opts || {};
    if (typeof opts.dim === 'boolean') App.nightDim = opts.dim;
    if (typeof opts.red === 'boolean') App.nightRed = opts.red;
    var stage = $('#stage');
    if (App.nightRed && App.mode === 'night') stage.dataset.red = '1';
    else if (!App.nightRed) stage.removeAttribute('data-red');
    // Turning dimming off takes effect on the next poll, not at the next wake:
    // a frame already resting in the dimmed night view moves to the photo view.
    if (!App.nightDim && App.mode === 'night') App.setMode('ambient');
  };


  // ------------------------------------------------------------ idle
  App.idle = { home: 60, ambient: 120 };
  var idleSec = 0;
  function onIdleTick() {
    idleSec++;
    if (App.lock && App.lock.active()) return; // locked: the pinned view stays put
    var blocked = $('#takeover').classList.contains('is-open');
    if (App.mode !== 'day' || blocked) return;
    if (idleSec === App.idle.home && App.current !== 'home') { App.closeSheet(); App.go('home'); }
    if (idleSec >= App.idle.ambient) {
      App.closeSheet();
      App.go('home');
      App.setMode(App.isNight() && App.nightDim ? 'night' : 'ambient');
    }
  }
  App.resetIdle = function () { idleSec = 0; };

  // ------------------------------------------------------------ nightly reload
  // This page runs for weeks on the frame. Reload once a day so a long-lived
  // WebView cannot accumulate leaks or drift. It runs during the quiet hours,
  // but by then the idle timer has already put the frame into night or ambient
  // mode, so the reload must restore that mode: booting into the day dashboard
  // at 03:00 would light the whole screen.
  // The day stamp is persisted: an in-memory flag would reset on each load and
  // reload again and again for the whole minute.
  App.reloadHour = 3;
  var RELOAD_KEY = 'hq.reloadDay';
  var MODE_KEY = 'hq.reloadMode';
  function lastReloadDay() {
    try { return localStorage.getItem(RELOAD_KEY) || ''; } catch (e) { return ''; }
  }
  function markReloaded(day, mode) {
    try {
      localStorage.setItem(RELOAD_KEY, day);
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {}
  }
  function maybeNightlyReload(n) {
    var day = n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
    // A short window, not a single minute, so a frame that was busy at 03:00
    // still catches up later that morning.
    if (n.getHours() < App.reloadHour || n.getHours() >= App.reloadHour + 3) return;
    if (lastReloadDay() === day) return; // already done today
    if (App.mode !== 'day' && App.mode !== 'ambient' && App.mode !== 'night') return;
    if (App.lock && App.lock.active()) return;
    markReloaded(day, App.mode);
    location.reload();
  }

  // After a reload that happened in a resting mode, put the display back the way
  // it was instead of leaving a bright dashboard on at 03:00. lock.js wraps
  // setMode on 'ready' to reject anything but day while locked, so a locked
  // frame must not rely on this; the reload itself already skips locked frames.
  function restoreReloadedMode() {
    var mode = null;
    try { mode = localStorage.getItem(MODE_KEY); localStorage.removeItem(MODE_KEY); } catch (e) {}
    if (mode !== 'ambient' && mode !== 'night') return;
    if (App.lock && App.lock.active()) return;
    App.setMode(mode);
  }

  // ------------------------------------------------------------ stage scaling (desktop preview only)
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
    $('#stage').style.transform = Math.abs(s - 1) < 0.01 ? '' : 'scale(' + s + ')';
  }

  // ------------------------------------------------------------ clock tick
  // This frame has no clock battery: every boot can start years off until the
  // network sets the time (and a loaded page can jump years). Any implausible
  // year means the clock is not yet trustworthy, so show it as unset rather
  // than a confidently wrong day. Adapted from
  // wellavelino/frameo-homeassistant-dashboard `clockTrusted` (MIT).
  var MIN_YEAR = 2025;
  App.clockTrusted = function (d) {
    var y = (d || App.now()).getFullYear();
    return y >= MIN_YEAR && y <= MIN_YEAR + 50;
  };
  var lastMin = -1, wasTrusted = null;
  function tick() {
    var n = App.now();
    var trusted = App.clockTrusted(n);
    App.emit('second', n);
    if (trusted !== wasTrusted) {
      // The clock arrived or lost trust: re-render everything that shows a date.
      wasTrusted = trusted;
      lastMin = -1;
      App.emit('time');
      App.rerender();
    }
    if (n.getMinutes() !== lastMin) {
      lastMin = n.getMinutes();
      $('#railClock').innerHTML = trusted
        ? '<b>' + App.fmt.time(n, false) + '</b><span>' + App.fmt.ampm(n) + '</span>'
        : '<b>--:--</b><span>' + 'SETTING' + '</span>';
      if (trusted) App.emit('minute', n);
    }
    if (trusted) maybeNightlyReload(n);
    onIdleTick();
  }

  // ------------------------------------------------------------ boot
  App.start = function () {
    fit();
    window.addEventListener('resize', fit);
    // Switch tabs the instant a finger lands (pointerdown), not on release. Keyboard "clicks"
    // (detail === 0) still work.
    $('#rail').addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.button === 0) App.go(b.dataset.go);
    });
    $('#rail').addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.detail === 0) App.go(b.dataset.go);
    });
    document.addEventListener('pointerdown', App.resetIdle, true);
    window.addEventListener('hashchange', function () { App.go(location.hash.slice(1)); });
    App.go(location.hash.slice(1) || 'home');
    tick();
    setInterval(tick, 1000);
    App.emit('ready');
    restoreReloadedMode();
    refreshStale(1500);
  };
  document.addEventListener('DOMContentLoaded', function () { App.start(); });
})();
