// Meals: one optional ICS calendar, entries bucketed by start time on the
// server into Breakfast (7-9 AM), Lunch (11 AM-1 PM) and Dinner (5-7 PM).
// Today, 3 Day and Week views mirror the Calendar section's top tabs.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, mode: 'day' };
  var MODES = [['day', 'Today'], ['3day', '3 Day'], ['week', 'Week']];
  var SLOTS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

  function isoDay(d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  function itemsFor(day, slot) {
    return ((D.meals || {}).items || []).filter(function (x) {
      return x && x.slot === slot && x.date === day;
    });
  }

  function bullets(list) {
    return '<ul class="m-list">' + list.map(function (x) {
      return '<li>' + App.esc(App.cleanTitle(x.title)) + '</li>';
    }).join('') + '</ul>';
  }

  function slotCard(day, slot, label) {
    var list = itemsFor(day, slot);
    return '<section class="m-slot">' +
      '<div class="label">' + label + '</div>' +
      (list.length
        ? bullets(list)
        : '<div class="m-none serif"><i>Nothing planned</i></div>') +
      '</section>';
  }

  function slotMini(day, slot, label) {
    var list = itemsFor(day, slot);
    return '<div class="m-mini">' +
      '<div class="label">' + label + '</div>' +
      (list.length
        ? '<ul class="m-mini-list">' + list.map(function (x) {
            return '<li>' + App.esc(App.cleanTitle(x.title)) + '</li>';
          }).join('') + '</ul>'
        : '<span class="m-mini-none">—</span>') +
      '</div>';
  }

  function dayColumn(d) {
    var today = App.sameDay(d, App.now());
    return '<section class="m-day' + (today ? ' is-today' : '') + '">' +
      '<div class="m-day-head"><b>' + App.fmt.rel(d) + '</b>' +
      '<span>' + App.fmt.monthShort(d) + ' ' + d.getDate() + '</span></div>' +
      SLOTS.map(function (s) { return slotMini(isoDay(d), s[0], s[1]); }).join('') +
      '</section>';
  }

  function daysFrom(n) {
    var start = App.dayStart(App.now()), out = [];
    for (var i = 0; i < n; i++) out.push(App.addDays(start, i));
    return out;
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
    var week = App.addDays(now, 6);
    return 'Next 7 days · ' + App.fmt.monthShort(now) + ' ' + now.getDate() +
      ' – ' + App.fmt.monthShort(week) + ' ' + week.getDate();
  }

  function body() {
    var m = D.meals || { status: 'off', items: [] };
    if (m.status === 'off') {
      return '<div class="m-empty serif">No meal calendar configured.<br><i>Mark a calendar as Meal calendar in StartOS → Actions &amp; Config → Edit Calendars.</i></div>';
    }
    if (m.status === 'unavailable') {
      return '<div class="m-empty serif">Meal calendar unavailable.<br><i>Check the link in Edit Calendars, then run Sync Now.</i></div>';
    }
    if (V.mode === 'day') {
      return '<div class="m-grid">' + SLOTS.map(function (s) {
        return slotCard(isoDay(App.now()), s[0], s[1]);
      }).join('') + '</div>';
    }
    var count = V.mode === '3day' ? 3 : 7;
    return '<div class="m-days m-days--' + count + '">' +
      daysFrom(count).map(dayColumn).join('') + '</div>';
  }

  function render() {
    var m = D.meals || { status: 'off', items: [] };
    V.el.innerHTML = '<div class="meals">' +
      '<header class="m-head">' +
      '<div class="m-title"><div class="label">' + rangeLabel() + '</div><h1 class="serif">Meals</h1></div>' +
      '<div class="seg">' + MODES.map(function (mode) {
        return '<button class="' + (V.mode === mode[0] ? 'is-on' : '') + '" data-mode="' + mode[0] + '">' + mode[1] + '</button>';
      }).join('') + '</div>' +
      (m.name ? '<div class="m-source label">' + App.esc(m.name) + '</div>' : '') +
      '</header>' + body() + '</div>';
  }

  App.register('meals', {
    show: function (el) {
      V.el = el;
      if (!el._mealsBound) {
        el._mealsBound = true;
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

  App.on('data', function () { if (App.current === 'meals' && V.el) render(); });
  App.on('minute', function () { if (App.current === 'meals' && V.el) render(); });
})();
