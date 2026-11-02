// Home / Today: the glanceable overview. Never scrolls.
(function () {
  'use strict';
  var D = window.DATA, V = {};

  function clock() {
    var n = App.now();
    if (!App.clockTrusted(n)) {
      return '<div class="h-time num">--:--</div>' +
        '<div class="h-date"><b>Waiting for network time</b></div>';
    }
    return '<div class="h-time num">' + App.fmt.time(n, false) + '<span class="h-ampm">' + App.fmt.ampm(n) + '</span></div>' +
      '<div class="h-date"><b>' + App.fmt.day(n) + '</b> ' + App.fmt.month(n) + ' ' + n.getDate() + '</div>';
  }

  function weather() {
    if (!App.hasWeather()) {
      return '<div class="h-wx-unavailable">' +
        '<div class="label">Weather</div>' +
        '<b class="serif">Unavailable</b>' +
        '<span>Set a location in StartOS and run Sync Now.</span>' +
        '</div>';
    }
    var w = App.weatherNow();
    var hours = App.hourly(7);
    var tmin = Math.min.apply(null, hours.map(function (h) { return h.t; }));
    var tmax = Math.max.apply(null, hours.map(function (h) { return h.t; }));
    return '<div class="h-wx-top">' +
      '<span class="h-wx-icon">' + App.icon(w.cond, 60) + '</span>' +
      '<span class="h-wx-temp num">' + w.temp + '°</span>' +
      '<span class="h-wx-meta"><b>' + w.label + '</b><span>H ' + w.hi + '°  L ' + w.lo + '°</span></span>' +
      '</div>' +
      '<div class="h-wx-say"><b>' + w.summary + '.</b> ' + w.advice + '.</div>' +
      '<div class="h-wx-hours">' + hours.map(function (h) {
        var lift = tmax === tmin ? 0 : Math.round((h.t - tmin) / (tmax - tmin) * 8);
        return '<div class="h-hr' + (h.p >= 50 ? ' is-wet' : '') + '"><span class="h-hr-l">' + h.label + '</span>' +
          '<span class="h-hr-i" style="transform:translateY(' + -lift + 'px)">' + App.icon(h.c, 22) + '</span><b>' + h.t + '°</b></div>';
      }).join('') + '</div>';
  }
  // Top-right corner: the configured users, each opening their personal home.
  // Falls back to calendar status when no users are configured.
  function presence() {
    var users = D.users || [];
    if (!users.length) {
      return D.people.map(function (p) {
        var sub = p.home ? 'Home' : (p.eta ? '<b>ETA ' + p.eta + ' min</b>' : App.esc(p.status || ''));
        return '<div class="h-who' + (p.home ? ' is-home' : '') + '" style="' + App.pstyle(p) + '">' +
          App.avatar(p, 36, p.home ? '' : 'avatar--away') +
          '<span><b>' + App.esc(p.name) + '</b><small>' + sub + '</small></span></div>';
      }).join('');
    }
    return users.map(function (u) {
      var p = { id: u.id, name: u.name, color: u.color, rgb: u.rgb, ink: u.ink };
      var keys = u.calendarKeys || [];
      var next = keys.length
        ? App.timedOn(App.now()).filter(function (e) { return e.end > App.now() && e.people.some(function (p) { return keys.indexOf(p) > -1; }); })[0]
        : null;
      var sub = next ? App.fmt.time(next.start) + ' · ' + App.esc(next.title) : App.esc((u.calendarNames || []).join(' · ') || 'Personal home');
      return '<button class="h-who h-user" data-user="' + u.id + '" style="' + App.pstyle(p) + '">' +
        App.avatar(p, 36) +
        '<span><b>' + App.esc(u.name) + '</b><small>' + sub + '</small></span></button>';
    }).join('');
  }

  function hero() {
    var home = D.homePeople || D.people;
    var keys = home.map(function (p) { return p.id; });
    var now = App.now();
    var e = App.nextEvent(keys), tomorrow = null;
    if (!e) {
      tomorrow = App.timedOn(App.addDays(now, 1)).filter(function (x) {
        return keys.length > 0 && x.people.some(function (id) { return keys.indexOf(id) > -1; });
      })[0];
    }
    if (!e) {
      return '<div class="h-hero h-hero--empty" data-go="calendar">' +
        '<div class="label label--light">Rest of today</div>' +
        '<div class="h-hero-title serif">Nothing else scheduled.<br><i>Enjoy the quiet.</i></div>' +
        (tomorrow ? '<div class="h-hero-meta">Tomorrow starts with <b>' + App.esc(tomorrow.title) + '</b> at ' + App.fmt.time(tomorrow.start) + '</div>' : '') +
        '</div>';
    }
    var p = App.evColor(e);
    var mins = (e.start - now) / 60000;
    var leave = (App.leaveBy(e) - now) / 60000;
    var who = e.people.map(function (id) { return App.person(id).name; });
    var whoText = App.isFamily(e) ? 'Everyone' : who.join(' + ');
    var big = mins < 100
      ? '<div class="h-hero-count num">' + Math.round(mins) + '<small>min</small></div>'
      : '<div class="h-hero-count num">' + App.fmt.time(e.start, false) + '<small>' + App.fmt.ampm(e.start) + '</small></div>';
    var leavePill = '';
    if (e.travel) {
      leavePill = leave <= 0
        ? '<span class="pill pill--alert"><i class="pulse"></i>Leave now</span>'
        : '<span class="pill' + (leave <= 15 ? ' pill--soon' : '') + '">' + App.icon('car', 20) + 'Leave in ' + App.fmt.mins(leave) + '</span>';
    }
    return '<button class="h-hero" style="' + App.pstyle(p) + '" data-ev="' + e.id + '">' +
      '<div class="h-hero-main">' +
      '  <div class="label label--on">Next up · ' + App.esc(whoText) + '</div>' +
      '  <div class="h-hero-title serif">' + App.esc(e.title) + '</div>' +
      '  <div class="h-hero-meta">' + App.fmt.range(e.start, e.end) + (e.loc ? ' · ' + App.esc(e.loc) : '') + '</div>' +
      '  <div class="h-hero-foot">' + (e.people.length > 1 ? App.dots(e.people, 22) : '') + leavePill + '</div>' +
      '</div>' + big + '</button>';
  }

  function lanes() {
    var home = D.homePeople || D.people;
    if (!home.length) return '<div class="h-free serif">Add your calendars in StartOS<br><i>Actions &amp; Config → Edit Calendars</i></div>';
    var now = App.now();
    return home.map(function (p) {
      var list = App.timedOn(now, p.id).filter(function (e) { return e.end > now; });
      var shown = list.slice(0, 3), more = list.length - shown.length;
      return '<div class="h-lane" style="' + App.pstyle(p) + '">' +
        '<div class="h-lane-head">' + App.avatar(p, 30) + '<b>' + App.esc(p.name) + '</b></div>' +
        (list.length ? shown.map(function (e) {
          var cur = e.start <= now;
          return '<button class="h-ev' + (cur ? ' is-now' : '') + '" data-ev="' + e.id + '">' +
            '<span class="h-ev-t">' + (cur ? 'Now' : App.fmt.time(e.start, false)) + '</span>' +
            '<span class="h-ev-n">' + App.esc(e.title) + '</span></button>';
        }).join('') : '<div class="h-free serif"><i>Free</i> the rest of the day</div>') +
        (more > 0 ? '<button class="h-more" data-go="calendar">+' + more + ' more</button>' : '') +
        '</div>';
    }).join('');
  }

  function ring(done, total, size) {
    var r = size / 2 - 5, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * f) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  App.ring = ring;

  function chores() {
    var r = App.currentRoutine();
    var who = App.choreLanes();
    return '<div class="label">Chores · ' + r.name + '</div><div class="h-rings">' + who.map(function (id) {
      var list = D.chores.filter(function (c) { return c.r === r.id && c.who === id; });
      if (!list.length) return '';
      var done = list.filter(function (c) { return c.done; }).length;
      var p = App.person(id);
      return '<div class="h-ring' + (done === list.length ? ' is-done' : '') + '" style="' + App.pstyle(p) + '">' + ring(done, list.length, 64) +
        '<b class="num">' + (done === list.length ? '✓' : done + '/' + list.length) + '</b><span>' + (id === 'any' ? 'Anyone' : App.esc(p.name)) + '</span></div>';
    }).join('') + '</div>';
  }

  function shopping() {
    var open = D.groceries.filter(function (g) { return !g.done; });
    var recent = open.slice(-3).reverse();
    return '<div class="label">Groceries</div>' +
      '<div class="h-stat"><span class="num">' + open.length + '</span><small>items to get</small></div>' +
      '<ul class="h-recent">' + recent.map(function (g) {
        return '<li><i></i>' + App.esc(g.name) + '</li>';
      }).join('') + '</ul>';
  }

  function status() {
    return '<div class="label">Home</div>' +
      '<div class="h-status-soon serif">Control4 integration coming soon.</div>';
  }

  // Blank and disable a Today card when its section is hidden in the sidebar.
  // Keeping the markup in place preserves the grid; emptying it and removing
  // data-go leaves neither hidden content nor a shortcut to the section.
  function gate(el, section, paintCard) {
    var on = App.sectionVisible(section);
    el.hidden = !on;
    if (on) {
      el.setAttribute('data-go', section);
      el.innerHTML = paintCard();
    } else {
      el.removeAttribute('data-go');
      el.innerHTML = '';
    }
  }

  function paint() {
    var el = V.el;
    var cal = App.sectionVisible('calendar');
    el.querySelector('.h-clock').innerHTML = clock();
    if (cal) el.querySelector('.h-clock').setAttribute('data-go', 'calendar');
    else el.querySelector('.h-clock').removeAttribute('data-go');

    gate(el.querySelector('.h-weather'), 'weather', weather);
    el.querySelector('.h-presence').innerHTML = presence();
    el.querySelector('.h-hero-slot').innerHTML = cal ? hero() : '';
    el.querySelector('.h-lanes').innerHTML = cal ? lanes() : '';

    var photo = el.querySelector('.h-photo');
    var showPhotos = App.sectionVisible('photos');
    photo.hidden = !showPhotos;
    if (showPhotos) {
      photo.setAttribute('data-go', 'photos');
      if (V.slides && V.slides.timer === null) V.slides.start();
    } else {
      // Stop the timer and drop the current slide so showing it again paints
      // immediately instead of waiting for the next interval.
      photo.removeAttribute('data-go');
      V.slides.stop();
      V.slides.current = null;
      V.slides.history = [];
      photo.querySelector('.h-photo-stage').innerHTML = '';
      photo.querySelector('.h-photo-cap').innerHTML = '';
    }

    gate(el.querySelector('.h-chores'), 'tasks', chores);
    gate(el.querySelector('.h-shop'), 'shopping', shopping);
    gate(el.querySelector('.h-status'), 'control', status);
  }

  function photoCaption(s) {
    if (!s) { V.el.querySelector('.h-photo-cap').innerHTML = ''; return; }
    var m = App.photoMeta(s.photos[0]);
    V.el.querySelector('.h-photo-cap').innerHTML = '<b>' + (m.onThisDay ? 'On this day · ' : '') + (m.knownDate ? m.kicker : m.date) + '</b><span>' + App.esc(m.place) + '</span>';
  }

  App.register('home', {
    show: function (el) {
      V.el = el;
      if (!el.firstChild) {
        el.innerHTML = '<div class="home">' +
          '<div class="h-clock" data-go="calendar"></div>' +
          '<div class="h-weather" data-go="weather"></div>' +
          '<div class="h-presence"></div>' +
          '<div class="h-main"><div class="h-hero-slot"></div><div class="h-lanes" ></div></div>' +
          '<div class="h-side">' +
          '  <button class="h-photo" data-go="photos"><div class="h-photo-stage"></div><div class="h-photo-cap"></div></button>' +
          '  <button class="h-chores card" data-go="tasks"></button>' +
          '  <div class="h-duo"><button class="h-shop card" data-go="shopping"></button><button class="h-status card" data-go="control"></button></div>' +
          '</div></div>';
        el.addEventListener('click', function (e) {
          var ev = e.target.closest('[data-ev]');
          if (ev) { App.eventSheet(App.findEvent(ev.dataset.ev)); return; }
          var user = e.target.closest('[data-user]');
          if (user) { App.go('user-' + user.dataset.user); return; }
          var g = e.target.closest('[data-go]');
          if (g) App.go(g.dataset.go);
        });
        V.slides = new App.Slideshow(el.querySelector('.h-photo-stage'), { layout: 'cover', captions: false, interval: 12000, onChange: photoCaption });
      }
      paint();
    },
    resume: function () {
      if (App.sectionVisible('photos')) V.slides.start();
    },
    hide: function () { if (V.slides) V.slides.stop(); }
  });
  // Every minute: just the clock and next-up countdown (cheap, even while hidden). Weather on the hour.
  App.on('minute', function (n) {
    if (!V.el || !V.el.firstChild) return;
    V.el.querySelector('.h-clock').innerHTML = clock();
    if (App.sectionVisible('calendar')) V.el.querySelector('.h-hero-slot').innerHTML = hero();
    if (n.getMinutes() === 0) {
      if (App.sectionVisible('weather')) V.el.querySelector('.h-weather').innerHTML = weather();
      if (App.sectionVisible('calendar')) V.el.querySelector('.h-lanes').innerHTML = lanes();
    }
  });
  App.on('data', function () { if (App.current === 'home') paint(); });
})();
