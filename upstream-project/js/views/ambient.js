// Ambient (idle photo frame) and Night (dim red clock) overlays.
(function () {
  'use strict';
  var $ = App.$;
  var amb = { show: null }, shiftTimer = null;

  function ambientInfo() {
    var n = App.now(), w = App.weatherNow(), next = App.nextEvent();
    var wx = w
      ? App.icon(w.cond, 44) + '<span class="num">' + w.temp + '°</span><small>' + w.summary + '</small>'
      : '<small>Weather unavailable</small>';
    if (!App.clockTrusted(n)) {
      return '<div class="amb-clock"><div class="amb-time num">--:--</div>' +
        '<div class="amb-date">Waiting for network time</div></div>' +
        '<div class="amb-right"><div class="amb-wx"><small>Clock will set itself once the frame is online</small></div></div>';
    }
    return '<div class="amb-clock"><div class="amb-time num">' + App.fmt.time(n, false) + '</div>' +
      '<div class="amb-date">' + App.fmt.day(n) + ', ' + App.fmt.month(n) + ' ' + n.getDate() + '</div></div>' +
      '<div class="amb-right">' +
      '<div class="amb-wx">' + wx + '</div>' +
      (next ? '<div class="amb-next" style="' + App.pstyle(App.evColor(next)) + '"><i></i>' + App.esc(next.title) + ' · ' + App.fmt.time(next.start) + '</div>' : '') +
      '</div>';
  }
  function paint() {
    if (App.mode === 'ambient') $('#ambient .amb-info').innerHTML = ambientInfo();
  }

  // Nudge static content a few px every minute so nothing sits still for hours
  // (image retention). Night keeps the whole dashboard on screen, so the rail and
  // views shift as well; waking resets them.
  function shiftEl(el, dx, dy) {
    if (el) el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function pixelShift() {
    var x = Math.round(Math.random() * 8 - 4), y = Math.round(Math.random() * 8 - 4);
    App.$$('.amb-info').forEach(function (el) { shiftEl(el, x, y); });
    if (App.mode === 'night') {
      shiftEl($('#rail'), x, y);
      shiftEl($('.views'), x, y);
    }
  }
  function resetShift() {
    App.$$('.amb-info').forEach(function (el) { el.style.transform = ''; });
    shiftEl($('#rail'), 0, 0);
    shiftEl($('.views'), 0, 0);
  }

  App.on('ready', function () {
    $('#ambient').innerHTML = '<div class="amb-stage"></div><div class="amb-scrim"></div><div class="amb-info"></div>';
    amb.show = new App.Slideshow($('#ambient .amb-stage'), { layout: 'cover', captions: false, interval: 14000 });
    $('#ambient').addEventListener('click', function () { App.setMode('day'); App.go('home'); });
    // Night dims the dashboard rather than replacing it: the first touch only
    // wakes the screen, so it cannot accidentally toggle a light.
    $('#dim').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      App.setMode('day');
    }, true);
  });

  App.on('mode', function (m) {
    clearInterval(shiftTimer);
    resetShift();
    if (m === 'ambient') { amb.show.start(); paint(); shiftTimer = setInterval(pixelShift, 60000); }
    else amb.show.stop();
    // Night keeps the whole dashboard visible for hours, so it needs the same
    // anti-burn-in nudge the ambient photo view gets.
    if (m === 'night') shiftTimer = setInterval(pixelShift, 60000);
    App.resetIdle();
  });
  App.on('minute', paint);
})();
