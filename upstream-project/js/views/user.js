// Personal home pages for the people configured in StartOS (Edit Users).
// Each user gets a view registered at runtime and a rail-less route
// (#user-<id>), reachable from the presence list on Today.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, user: null, slides: null };

  function has(u, card) { return (u.cards || []).indexOf(card) > -1; }

  function today(u) {
    var now = App.now(), keys = u.calendarKeys || [];
    function on(day, timed) {
      var list = timed ? App.timedOn(day) : App.allDayOn(day);
      if (!keys.length) return [];
      return list.filter(function (e) {
        return e.people.some(function (p) { return keys.indexOf(p) > -1; });
      });
    }
    var timed = on(now, true).filter(function (e) { return e.end > now; });
    var all = on(now, false);
    var next = on(now, true).filter(function (e) { return e.start > now; })
      .sort(function (a, b) { return App.leaveBy(a) - App.leaveBy(b); })[0] || null;
    return { now: now, timed: timed, all: all, next: next };
  }

  function summary(u) {
    var t = today(u);
    var total = t.all.length + t.timed.length;
    if (!total) return '';
    var text = total + (total === 1 ? ' event' : ' events') + ' left today';
    if (t.next) text += ' · next at ' + App.fmt.time(t.next.start);
    else if (t.timed.some(function (e) { return e.start <= t.now; })) text += ' · in progress';
    else text += ' · all day';
    return '<div class="u-summary">' + text + '</div>';
  }

  function calendarCard(u) {
    var t = today(u);
    var rows = [];
    t.all.forEach(function (e) {
      rows.push('<li class="u-ev is-allday"><span class="u-ev-t">All day</span><span class="u-ev-n">' + App.esc(e.title) + '</span></li>');
    });
    t.timed.forEach(function (e) {
      var cur = e.start <= t.now;
      rows.push('<li class="u-ev' + (cur ? ' is-now' : '') + '" style="' + App.pstyle(App.evColor(e)) + '">' +
        '<span class="u-ev-t">' + (cur ? 'Now' : App.fmt.time(e.start, false)) + '</span>' +
        '<span class="u-ev-n">' + App.esc(e.title) + '</span></li>');
    });
    return '<section class="u-card u-cal">' +
      '<div class="label">' + (u.calendarNames && u.calendarNames.length ? App.esc(u.calendarNames.join(' · ')) : 'No calendar selected') + '</div>' +
      summary(u) +
      '<div class="u-card-body">' +
      (rows.length ? '<ul class="u-evs">' + rows.join('') + '</ul>' : '<div class="u-empty serif"><i>Free</i> the rest of the day</div>') +
      '</div></section>';
  }

  function weatherCard() {
    if (!App.hasWeather()) {
      return '<section class="u-card"><div class="label">Weather</div>' +
        '<div class="u-empty serif">Weather unavailable.<br><i>Set a location in StartOS and run Sync Now.</i></div></section>';
    }
    var w = App.weatherNow();
    return '<section class="u-card"><div class="label">Weather</div>' +
      '<div class="u-wx"><span class="u-wx-icon">' + App.icon(w.cond, 52) + '</span>' +
      '<span class="num u-wx-temp">' + w.temp + '°</span>' +
      '<span class="u-wx-meta"><b>' + w.label + '</b><span>H ' + w.hi + '° L ' + w.lo + '°</span></span></div>' +
      '<div class="u-wx-say serif">' + w.summary + '.</div></section>';
  }

  function photoCard(u) {
    return '<section class="u-card u-photo-card">' +
      '<div class="u-photo-stage"></div>' +
      '<div class="u-photo-cap"></div>' +
      '<div class="label u-photo-label">Photos</div></section>';
  }

  function choresCard(u) {
    var r = App.currentRoutine();
    var list = D.chores.filter(function (c) { return c.r === r.id && c.who === u.id; });
    var done = list.filter(function (c) { return c.done; }).length;
    return '<section class="u-card" style="' + App.pstyle(u) + '"><div class="label">Chores · ' + r.name + '</div>' +
      (list.length
        ? '<div class="u-chore-row">' + App.ring(done, list.length, 64) + '<b class="num">' + done + '/' + list.length + '</b></div>' +
          '<ul class="u-chore-list">' + list.slice(0, 4).map(function (c) {
            return '<li' + (c.done ? ' class="is-done"' : '') + '>' + (c.done ? '✓ ' : '') + App.esc(c.title) + '</li>';
          }).join('') + '</ul>'
        : '<div class="u-empty serif">No chores in this routine.</div>') +
      '</section>';
  }

  function shoppingCard() {
    var open = D.groceries.filter(function (g) { return !g.done; });
    return '<section class="u-card"><div class="label">Groceries</div>' +
      '<div class="u-stat"><span class="num">' + open.length + '</span><small>items to get</small></div>' +
      '<ul class="u-recent">' + open.slice(-3).reverse().map(function (g) { return '<li><i></i>' + App.esc(g.name) + '</li>'; }).join('') + '</ul></section>';
  }

  function homeCard() {
    return '<section class="u-card"><div class="label">Home</div>' +
      '<div class="u-empty serif">Control4 integration coming soon.</div></section>';
  }

  function paintPhotoCaption() {
    if (!V.slides || !V.slides.current) return;
    var s = V.slides.current;
    var cap = V.el.querySelector('.u-photo-cap');
    if (!cap) return;
    var m = App.photoMeta(s.photos[0]);
    cap.innerHTML = '<b>' + (m.onThisDay ? 'On this day · ' : '') + (m.knownDate ? m.kicker : m.date) + '</b><span>' + App.esc(m.place) + '</span>';
  }

  function body(u) {
    var cards = (u.cards || []).filter(function (c) { return ['calendar', 'weather', 'photos', 'chores', 'shopping', 'home'].indexOf(c) > -1; });
    var left = '', right = '';
    if (has(u, 'calendar')) left += calendarCard(u);
    ['weather', 'photos', 'chores', 'shopping', 'home'].forEach(function (card) {
      if (!has(u, card)) return;
      right += card === 'weather' ? weatherCard()
        : card === 'photos' ? photoCard(u)
        : card === 'chores' ? choresCard(u)
        : card === 'shopping' ? shoppingCard()
        : homeCard();
    });
    var bodyClass = left ? 'u-body' : 'u-body u-body--wide';
    return '<div class="u-page">' +
      '<header class="u-head">' +
      '<button class="u-back" data-go="home">' + App.icon('left', 24) + '<span>Today</span></button>' +
      '<div class="u-id" style="' + App.pstyle(u) + '">' + App.avatar(u, 46) + '<div><div class="label">Personal home</div><h1 class="serif">' + App.esc(u.name) + '</h1></div></div>' +
      '<div class="u-date">' + App.fmt.day(App.now()) + ' · ' + App.fmt.month(App.now()) + ' ' + App.now().getDate() + '</div>' +
      '</header>' +
      '<div class="' + bodyClass + '">' +
      (left ? '<div class="u-left">' + left + '</div>' : '') +
      (right ? '<div class="u-right">' + right + '</div>' : '<div class="u-empty serif">No cards selected for this user.</div>') +
      '</div></div>';
  }

  function render(el, u) {
    if (V.slides) V.slides.stop();
    V.el = el;
    V.user = u;
    el.innerHTML = body(u);
    if (has(u, 'photos')) {
      V.slides = new App.Slideshow(el.querySelector('.u-photo-stage'), {
        layout: 'cover', captions: false, interval: 12000, onChange: paintPhotoCaption
      });
      paintPhotoCaption();
    } else {
      V.slides = null;
    }
    el.onclick = function (e) {
      var g = e.target.closest('[data-go]');
      if (g) App.go(g.dataset.go);
    };
  }

  function makeView(u) {
    return {
      show: function (el) {
        render(el, u);
        if (V.slides) V.slides.start();
      },
      resume: function () { if (V.slides) V.slides.start(); },
      hide: function () { if (V.slides) V.slides.stop(); }
    };
  }

  // Server data can arrive after the page is built; repaint while visible.
  App.on('data', function () {
    if (!App.current || App.current.indexOf('user-') !== 0) return;
    var id = App.current.slice(5);
    var u = (D.users || []).filter(function (x) { return x.id === id; })[0];
    var el = document.getElementById('view-' + App.current);
    if (!u || !el) return;
    render(el, u);
    if (V.slides) V.slides.start();
  });

  // Register one view per configured user and drop views for removed users.
  App.syncUsers = function (users) {
    D.users = users || [];
    var main = document.querySelector('.views');
    var wanted = {};
    D.users.forEach(function (u) {
      var name = 'user-' + u.id;
      wanted[name] = true;
      if (!document.getElementById('view-' + name)) {
        var section = document.createElement('section');
        section.className = 'view';
        section.id = 'view-' + name;
        section.dataset.view = name;
        main.insertBefore(section, document.getElementById('banners'));
      }
      App.register(name, makeView(u));
    });
    var removedCurrent = false;
    Object.keys(App.views).forEach(function (name) {
      if (name.indexOf('user-') !== 0 || wanted[name]) return;
      if (App.current === name) {
        // Leave the page before its view disappears; App.go would otherwise
        // have no current view to hide.
        App.current = null;
        removedCurrent = true;
      }
      delete App.views[name];
      var el = document.getElementById('view-' + name);
      if (el) el.remove();
    });
    if (removedCurrent) App.go('home');
    if (App.current && App.current.indexOf('user-') === 0 && App.views[App.current]) {
      App.views[App.current].show(document.getElementById('view-' + App.current));
    }
  };
})();
