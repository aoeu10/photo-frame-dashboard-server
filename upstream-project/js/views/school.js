// School: optional section for calendars marked School calendar in Edit
// Calendars. Today, 3 Day, Week and Month views mirror the Calendar section.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, mode: 'day' };
  var MODES = [['day', 'Today'], ['3day', '3 Day'], ['week', 'Week'], ['month', 'Month']];
  var LIMIT = 6;

  function keys() { return (D.school && D.school.keys) || []; }

  function metaFor(key) {
    var calendars = (D.school && D.school.calendars) || [];
    for (var i = 0; i < calendars.length; i++) if (calendars[i].id === key) return calendars[i];
    return null;
  }

  function schoolEvents() {
    var ks = keys();
    if (!ks.length) return [];
    return D.events.filter(function (e) {
      return e.people.some(function (k) { return ks.indexOf(k) > -1; });
    });
  }

  function eventsOn(day) {
    var start = App.dayStart(day), end = App.addDays(start, 1);
    return schoolEvents().filter(function (e) { return e.start < end && e.end > start; })
      .sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start - b.start;
      });
  }

  function upcoming(limit) {
    var now = App.now();
    return schoolEvents().filter(function (e) { return e.end > now; })
      .sort(function (a, b) { return a.start - b.start; })
      .slice(0, limit);
  }

  function whenLabel(e) {
    return e.allDay ? 'All day' : App.fmt.time(e.start);
  }

  function agendaRow(e) {
    var meta = metaFor(e.people[0]);
    return '<li class="sc-row">' +
      '<span class="sc-when"><b>' + App.fmt.rel(e.start) + '</b>' +
      '<span>' + whenLabel(e) + '</span></span>' +
      '<span class="sc-title">' + App.esc(App.cleanTitle(e.title)) + '</span>' +
      (meta ? '<span class="sc-tag label">' + App.esc(meta.name) + '</span>' : '') +
      '</li>';
  }

  function column(d) {
    var evs = eventsOn(d);
    return '<div class="wk-col' + (App.sameDay(d, App.now()) ? ' is-today' : '') + '">' +
      '<div class="wk-head"><b>' + App.fmt.rel(d) + '</b><span class="num">' + d.getDate() + '</span></div>' +
      evs.map(function (e) {
        var style = App.pstyle(App.evColor(e));
        return e.allDay
          ? '<div class="wk-ad" style="' + style + '">' + App.esc(App.cleanTitle(e.title)) + '</div>'
          : '<div class="wk-ev" style="' + style + '">' +
            '<span class="wk-t">' + App.fmt.time(e.start, false) + '</span>' +
            '<span class="wk-n">' + App.esc(App.cleanTitle(e.title)) + '</span></div>';
      }).join('') +
      (evs.length ? '' : '<div class="wk-free serif"><i>Free</i></div>') +
      '</div>';
  }

  function columns(count, extraClass) {
    var start = App.dayStart(App.now()), out = '';
    for (var i = 0; i < count; i++) out += column(App.addDays(start, i));
    return '<div class="week ' + extraClass + '">' + out + '</div>';
  }

  function monthView() {
    var now = App.now();
    var first = App.date(now.getFullYear(), now.getMonth(), 1);
    var lead = (first.getDay() + 6) % 7; // Monday start
    var days = App.date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var count = Math.ceil((lead + days) / 7) * 7;
    var start = App.addDays(first, -lead);
    var cells = '';
    for (var i = 0; i < count; i++) {
      var d = App.addDays(start, i);
      var evs = eventsOn(d);
      var shown = evs.slice(0, 2);
      cells += '<div class="mo-cell' + (d.getMonth() !== first.getMonth() ? ' is-out' : '') +
        (App.sameDay(d, now) ? ' is-today' : '') + '">' +
        '<span class="num">' + d.getDate() + '</span>' +
        '<span class="mo-evs">' + shown.map(function (e) {
          return '<span class="mo-ev" style="' + App.pstyle(App.evColor(e)) + '">' +
            (e.allDay ? '' : '<span class="mo-ev-t">' + App.fmt.time(e.start, false) + '</span>') +
            '<span class="mo-ev-n">' + App.esc(App.cleanTitle(e.title)) + '</span></span>';
        }).join('') + '</span>' +
        (evs.length > shown.length ? '<span class="mo-more">+' + (evs.length - shown.length) + ' more</span>' : '') +
        '</div>';
    }
    return '<div class="month"><div class="mo-dow">' +
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) {
        return '<span class="label">' + d + '</span>';
      }).join('') + '</div>' +
      '<div class="mo-grid rows' + (count / 7) + '">' + cells + '</div></div>';
  }

  function todayView() {
    var list = eventsOn(App.now());
    if (list.length) {
      return '<ul class="sc-list">' + list.map(agendaRow).join('') + '</ul>';
    }
    var next = upcoming(3);
    if (next.length) {
      return '<div class="sc-none label">Nothing scheduled today · next activities</div>' +
        '<ul class="sc-list">' + next.map(agendaRow).join('') + '</ul>';
    }
    return '<div class="sc-empty serif">Nothing scheduled.<br><i>Enjoy the break.</i></div>';
  }

  function rangeLabel() {
    var now = App.now();
    if (V.mode === 'day') {
      return App.fmt.day(now) + ' · ' + App.fmt.month(now) + ' ' + now.getDate();
    }
    if (V.mode === '3day') {
      var end = App.addDays(now, 2);
      return App.fmt.month(now) + ' ' + now.getDate() + ' – ' +
        App.fmt.dayShort(end) + ' ' + end.getDate();
    }
    if (V.mode === 'week') {
      var week = App.addDays(now, 6);
      return 'Next 7 days · ' + App.fmt.monthShort(now) + ' ' + now.getDate() +
        ' – ' + App.fmt.monthShort(week) + ' ' + week.getDate();
    }
    return App.fmt.month(now) + ' ' + now.getFullYear();
  }

  function body() {
    var calendars = (D.school && D.school.calendars) || [];
    var allDown = calendars.length > 0 && calendars.every(function (c) {
      return c.status === 'Calendar unavailable';
    });
    if (!calendars.length) {
      return '<div class="sc-empty serif">No school calendar configured.<br><i>Mark a calendar as School calendar in StartOS → Actions &amp; Config → Edit Calendars.</i></div>';
    }
    if (allDown) {
      return '<div class="sc-empty serif">School calendars unavailable.<br><i>Check the links in Edit Calendars, then run Sync Now.</i></div>';
    }
    if (V.mode === 'day') return todayView();
    if (V.mode === '3day') return columns(3, 'sc-cols--3');
    if (V.mode === 'week') return columns(7);
    return monthView();
  }

  function render() {
    var calendars = (D.school && D.school.calendars) || [];
    var names = calendars.map(function (c) { return c.name; }).join(' · ');
    V.el.innerHTML = '<div class="school">' +
      '<header class="sc-head">' +
      '<div class="sc-title-block"><div class="label">' +
      (names ? App.esc(names) : 'School calendars') + ' · ' + rangeLabel() + '</div>' +
      '<h1 class="serif">School</h1></div>' +
      '<div class="seg">' + MODES.map(function (mode) {
        return '<button class="' + (V.mode === mode[0] ? 'is-on' : '') + '" data-mode="' + mode[0] + '">' + mode[1] + '</button>';
      }).join('') + '</div>' +
      '</header>' + body() + '</div>';
  }

  App.register('school', {
    show: function (el) {
      V.el = el;
      if (!el._schoolBound) {
        el._schoolBound = true;
        el.addEventListener('click', function (e) {
          var t = e.target.closest('[data-mode]');
          if (!t || t.dataset.mode === V.mode) return;
          V.mode = t.dataset.mode;
          render();
        });
      }
      render();
    }
  });

  App.on('data', function () { if (App.current === 'school' && V.el) render(); });
  App.on('minute', function () { if (App.current === 'school' && V.el) render(); });
})();
