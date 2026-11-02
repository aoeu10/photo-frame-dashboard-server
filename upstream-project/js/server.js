// Server data: pulls /api/frame from the box and merges it into DATA. When
// the server answers, real events/calendars/weather/photos replace demo
// content and App.emit('data') rebuilds every view. When it does not answer,
// a full-screen message replaces the dashboard instead of showing demo data.
(function () {
  'use strict';
  var POLL_MS = 60000;

  function hexToRgbParts(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return { rgb: r + ' ' + g + ' ' + b, ink: (0.3 * r + 0.6 * g + 0.1 * b) > 150 ? '#111111' : '#FFFFFF' };
  }

  function merge(frame) {
    if (!frame || frame.ok === false) return false;
    var D = window.DATA, App = window.App, changed = false;

    if (App.setTimeZone(frame.timezone)) changed = true;

    // Night display preferences come from StartOS config.
    if (frame.night) {
      if (App.nightRed !== !!frame.night.red || App.nightDim !== !!frame.night.dim) changed = true;
      App.setNightDisplay({ dim: !!frame.night.dim, red: !!frame.night.red });
    }

    // The configured calendars are authoritative, including an empty roster.
    var people = (frame.calendars || []).map(function (c) {
      var parts = hexToRgbParts(c.color) || { rgb: '17 17 17', ink: '#FFFFFF' };
      return { id: c.key, name: c.name, color: c.color || '#111111', rgb: parts.rgb, ink: parts.ink,
        status: c.status === 'unavailable' ? 'Calendar unavailable' : 'Calendar',
        user: c.user || '', home: c.home !== false };
    });
    if (JSON.stringify(people) !== JSON.stringify(D.people)) changed = true;
    D.people = people;
    D.ALL = people.map(function (p) { return p.id; });
    // Today only shows calendars flagged for the homepage; the Calendar tab
    // always has every configured calendar.
    D.homePeople = people.filter(function (p) { return p.home; });
    document.querySelector('#stage').style.setProperty('--people-count', Math.max(1, D.homePeople.length));

    // Events: {uid, title, start(iso), end(iso), allDay, people:[cal keys], loc}
    var events = (frame.events || []).map(function (e) {
      return {
        id: e.uid,
        title: App.cleanTitle(e.title),
        start: App.date(e.start),
        end: App.date(e.end),
        allDay: !!e.allDay,
        people: e.people || [],
        loc: App.cleanTitle(e.location || '')
      };
    });
    if (JSON.stringify(events) !== JSON.stringify(D.events)) changed = true;
    D.events = events;

    // School calendars: their events are already in D.events, tagged with a
    // school key. This carries the keys, labels and colors for the opt-in
    // School section and for coloring those events.
    if (frame.school) {
      var schoolCalendars = (frame.school.calendars || []).map(function (c) {
        var parts = hexToRgbParts(c.color) || { rgb: '45 91 255', ink: '#FFFFFF' };
        return { id: c.key, name: c.name, color: c.color || '#2D5BFF', rgb: parts.rgb, ink: parts.ink,
          users: c.users || [], status: c.status === 'unavailable' ? 'Calendar unavailable' : 'School' };
      });
      var school = { keys: frame.school.keys || [], calendars: schoolCalendars };
      if (JSON.stringify(school) !== JSON.stringify(D.school || null)) {
        D.school = school;
        D.schoolPeople = schoolCalendars;
        changed = true;
      }
    } else if (D.school || D.schoolPeople) {
      D.school = { keys: [], calendars: [] };
      D.schoolPeople = [];
      changed = true;
    }

    // Meals: the service buckets entries by start time; the frame shows today's.
    if (frame.meals) {
      if (JSON.stringify(frame.meals) !== JSON.stringify(D.meals || null)) {
        D.meals = frame.meals;
        changed = true;
      }
    } else if (D.meals) {
      D.meals = { status: 'off', name: '', items: [] };
      changed = true;
    }

    // Weather: the server emits the D.weather shape ({t,c,p arrays + hi/lo})
    // only when it has real data. No demo forecast is kept as a fallback.
    if (frame.weather && frame.weather.t) {
      var w = frame.weather;
      if (JSON.stringify(w) !== JSON.stringify(D.weather)) { D.weather = w; changed = true; }
    } else if (D.weather !== null) {
      D.weather = null;
      changed = true;
    }

    // An empty server manifest replaces demo photos too; it is not a demo fallback.
    if (Array.isArray(frame.photos)) {
      if (JSON.stringify(frame.photos) !== JSON.stringify(D.photos || [])) { D.photos = frame.photos; changed = true; }
    }

    // Sidebar order and visibility. The service always sends the full list;
    // apply it only when it differs so the rail is not rebuilt every minute.
    if (Array.isArray(frame.nav) && JSON.stringify(frame.nav) !== JSON.stringify(D.nav || null)) {
      D.nav = frame.nav;
      App.setNav(frame.nav);
      changed = true;
    }

    // Configured users: the presence list and personal home routes.
    if (Array.isArray(frame.users)) {
      var users = frame.users.map(function (u) {
        var parts = hexToRgbParts(u.color) || { rgb: '17 17 17', ink: '#FFFFFF' };
        return {
          id: u.id, name: u.name, color: u.color || '#111111', rgb: parts.rgb, ink: parts.ink,
          calendarKeys: u.calendarKeys || [], calendarNames: u.calendarNames || [],
          cards: u.cards || []
        };
      });
      if (JSON.stringify(users) !== JSON.stringify(D.users || [])) {
        D.users = users;
        if (App.syncUsers) App.syncUsers(users);
        changed = true;
      }
    }

    // Chores: the server owns the configured roster. Completion marks stay in
    // this page session, keyed by chore id, until the roster changes.
    if (Array.isArray(frame.chores)) {
      var prior = {};
      (D.chores || []).forEach(function (c) { prior[c.id] = c; });
      var chores = frame.chores.map(function (c) {
        var old = prior[c.id];
        return { id: c.id, r: c.r, who: c.who, title: c.title, emoji: c.emoji,
          stars: c.stars || 0, done: !!(old && old.done), doneBy: old && old.doneBy };
      });
      var sig = chores.map(function (c) {
        return [c.id, c.r, c.who, c.title, c.emoji, c.stars].join('\u0001');
      }).join('\u0002');
      if (sig !== D.choreSig) {
        D.chores = chores;
        D.choreSig = sig;
        D.stars = {};
        D.week = {};
        changed = true;
      }
    }

    // Shopping: the server owns the catalog and list. The frame posts list
    // changes back, so selections survive reloads and other screens see them.
    if (frame.shopping) {
      var s = frame.shopping;
      var shopping = {
        stores: (s.stores || []).map(function (name) { return { id: name, name: name }; }),
        categories: s.categories || [],
        items: s.items || [],
        list: (s.list || []).filter(function (e) { return !e.done; }).map(function (e, i) {
          return { id: 'g' + i, name: e.name, cat: e.category, qty: e.qty || 1,
            store: e.store, done: !!e.done, note: e.note || '' };
        })
      };
      if (JSON.stringify(shopping) !== JSON.stringify(D.shopping || null)) {
        D.shopping = shopping;
        D.groceries = shopping.list;
        D.stores = shopping.stores.length ? shopping.stores : D.stores;
        D.catalog = shopping.items.map(function (item) { return [item.name, item.category]; });
        D.usuals = shopping.items.filter(function (item) { return item.usual; }).map(function (item) { return item.name; });
        D.catOrder = {};
        D.catOrder.all = shopping.categories.length ? shopping.categories : D.catOrder.all;
        shopping.stores.forEach(function (store) {
          D.catOrder[store.id] = D.catOrder.all;
        });
        changed = true;
      }
    }

    if (frame.units && frame.units.temperature) D.units = frame.units;
    return changed;
  }

  function setOffline(failed) {
    var el = document.getElementById('offline');
    if (!el) return;
    if (!failed) { el.hidden = true; return; }
    el.hidden = false;
    el.querySelector('h1').textContent = 'Dashboard cannot be reached';
    el.querySelector('p').textContent =
      'Check that the StartOS server is running. The frame retries automatically.';
  }

  function poll() {
    fetch('/api/frame', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (frame) {
      var changed = window.Server.merge(frame);
      window.Server.online = true;
      window.Server.lastOk = Date.now();
      setOffline(false);
      if (changed) App.emit('data');
    }).catch(function () {
      window.Server.online = false;
      setOffline(true);
    });
  }

  window.Server = { merge: merge, poll: poll, online: false, lastOk: 0, setOffline: setOffline };

  window.addEventListener('DOMContentLoaded', function () {
    poll();
    setInterval(poll, POLL_MS);
  });
})();
