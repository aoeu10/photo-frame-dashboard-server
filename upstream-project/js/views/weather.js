// Weather: full-screen forecast (current conditions, hourly, seven days) with a
// looping radar animation over the configured location.
// Radar data comes from RainViewer's free public API (personal use; attribution
// required) via the box's /api/radar proxy. Open-Meteo supplies the forecast and
// has no radar of its own.
(function () {
  'use strict';
  var D = window.DATA, $ = App.$;
  var V = { el: null, radar: null, bufferedRadar: null, radarKey: '', radarAt: 0, frames: [], images: [], idx: 0, timer: null, failed: false, generation: 0, zoom: 7 };
  var DRY_NOTICE = 'Local tile: no significant echoes';

  var LABELS = { sun: 'Sunny', moon: 'Clear', partly: 'Partly cloudy', cloud: 'Overcast', rain: 'Rain' };
  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var ZOOM = 7;      // RainViewer's maximum source zoom; overzoom for local maps.
  var TILE = 256;

  function w() { return D.weather || {}; }

  // ------------------------------------------------------------ current + hourly
  function current() {
    var W = w(), n = W.now || {}, h = App.now().getHours();
    var temp = n.temp != null ? n.temp : W.t[h];
    var cond = n.c != null ? n.c : W.c[h];
    return '<div class="wx-now">' +
      '<div class="wx-now-main">' +
      '  <span class="wx-now-icon">' + App.icon(cond, 96) + '</span>' +
      '  <div class="wx-now-num"><span class="num">' + temp + '°</span><small>' + (LABELS[cond] || '') + '</small></div>' +
      '  <div class="wx-now-hl"><b>H ' + W.hi + '°</b><span>L ' + W.lo + '°</span></div>' +
      '</div>' +
      '<div class="wx-facts">' +
      fact('Feels like', n.feels != null ? n.feels + '°' : '—') +
      fact('Humidity', n.humidity != null ? n.humidity + '%' : '—') +
      fact('Wind', n.wind != null ? n.wind + ' mph' : '—') +
      fact('Gusts', n.gust != null ? n.gust + ' mph' : '—') +
      fact('Pressure', n.pressure != null ? n.pressure + ' hPa' : '—') +
      fact('Rain now', n.precip != null ? n.precip + ' mm' : '—') +
      '</div></div>';
  }

  function fact(label, value) {
    return '<div class="wx-fact"><span class="label">' + label + '</span><b class="num">' + value + '</b></div>';
  }

  function hourly() {
    var W = w(), next = W.next || [], out = '';
    if (next.length) {
      // Server-supplied forward slots: correct across midnight.
      next.slice(0, 12).forEach(function (h, i) {
        out += '<div class="wx-hr' + (h.p >= 50 ? ' is-wet' : '') + '">' +
          '<span class="wx-hr-l">' + (i === 0 ? 'Now' : ((h.hour % 12 || 12) + (h.hour >= 12 ? 'p' : 'a'))) + '</span>' +
          App.icon(h.c, 30) +
          '<b class="num">' + h.t + '°</b>' +
          '<span class="wx-hr-p">' + h.p + '%</span></div>';
      });
      return '<div class="wx-card wx-hourly"><div class="label">Next 12 hours</div><div class="wx-hrs">' + out + '</div></div>';
    }
    var h0 = App.now().getHours();
    for (var i = 0; i < 12; i++) {
      var x = (h0 + i) % 24;
      out += '<div class="wx-hr' + ((W.p[x] || 0) >= 50 ? ' is-wet' : '') + '">' +
        '<span class="wx-hr-l">' + (i === 0 ? 'Now' : ((x % 12 || 12) + (x >= 12 ? 'p' : 'a'))) + '</span>' +
        App.icon(W.c[x], 30) +
        '<b class="num">' + W.t[x] + '°</b>' +
        '<span class="wx-hr-p">' + (W.p[x] || 0) + '%</span></div>';
    }
    return '<div class="wx-card wx-hourly"><div class="label">Next 12 hours</div><div class="wx-hrs">' + out + '</div></div>';
  }

  function forecast() {
    var days = w().days || [];
    if (!days.length) return '';
    return '<div class="wx-card wx-days"><div class="label">Seven days</div>' +
      days.map(function (d, i) {
        var dt = App.date(d.date + 'T12:00:00');
        var name = i === 0 ? 'Today' : DAY_SHORT[dt.getDay()];
        return '<div class="wx-day' + (i === 0 ? ' is-today' : '') + '">' +
          '<span class="wx-day-n">' + name + '</span>' +
          '<span class="wx-day-d">' + App.fmt.monthShort(dt) + ' ' + dt.getDate() + '</span>' +
          '<span class="wx-day-i">' + App.icon(d.cond, 30) + '</span>' +
          '<span class="wx-day-t"><b class="num">' + d.hi + '°</b><span>' + d.lo + '°</span></span>' +
          '<span class="wx-day-p">' + (d.p ? d.p + '%' : '—') + '</span>' +
          '<span class="wx-day-s">' + d.sunrise + ' / ' + d.sunset + '</span>' +
          '</div>';
      }).join('') + '</div>';
  }

  // ------------------------------------------------------------ radar
  // RainViewer tiles are served on a global grid at /v2/radar/<frame>/256/{z}/{x}/{y}/2/1_1.png.
  function lonLatToTile(lat, lon, z) {
    var n = Math.pow(2, z);
    var fx = (lon + 180) / 360 * n;
    var latRad = lat * Math.PI / 180;
    var fy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x: Math.floor(fx), y: Math.floor(fy), fx: fx - Math.floor(fx), fy: fy - Math.floor(fy) };
  }

  // A 3x3 block of tiles around the location. Its position is set in JS from the
  // measured panel size so the configured point — not the centre of the centre
  // tile — lands at the panel's middle.
  function radarPanel() {
    var loc = (D.weather && D.weather.loc) || null;
    if (!loc) return '';
    var t = lonLatToTile(loc.lat, loc.lon, ZOOM);
    var tiles = '';
    [-1, 0, 1].forEach(function (dy) {
      [-1, 0, 1].forEach(function (dx) {
        tiles += '<div class="wx-tile" data-x="' + (t.x + dx) + '" data-y="' + (t.y + dy) + '"></div>';
      });
    });
    return '<div class="wx-card wx-radar">' +
      '<div class="wx-radar-head"><div class="label">Radar · last 2 hours</div>' +
      '<div class="wx-map-controls"><button data-map-zoom="-1" aria-label="Zoom out"' + (V.zoom === 7 ? ' disabled' : '') + '>−</button>' +
      '<span>Zoom ' + V.zoom + '</span><button data-map-zoom="1" aria-label="Zoom in"' + (V.zoom === 10 ? ' disabled' : '') + '>+</button></div></div>' +
      '<div class="wx-radar-frame"><div class="wx-map-tiles"></div><div class="wx-tiles">' + tiles + '</div>' +
      '<div class="wx-radar-dot" aria-hidden="true"></div>' +
      '<div class="wx-radar-empty" hidden>Radar unavailable</div>' +
      '<div class="wx-map-status">Loading map…</div>' +
      '<div class="wx-map-credit">Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors<br>' +
      'U.S. boundaries: <a href="https://www.census.gov/" target="_blank" rel="noopener">U.S. Census Bureau</a></div>' +
      '</div>' +
      '<div class="wx-radar-foot"><span class="wx-radar-time">Loading radar…</span>' +
      '<div class="wx-radar-bar"><i></i></div></div>' +
      '</div>';
  }

  // Place the tile block so the configured coordinate sits at the panel centre.
  // The 3x3 block's middle tile is column 1, row 1; the point is (fx,fy) inside it.
  function positionRadar(el) {
    var loc = D.weather && D.weather.loc;
    var panel = el.querySelector('.wx-radar-frame');
    var block = el.querySelector('.wx-tiles');
    if (!loc || !panel || !block) return;
    var t = lonLatToTile(loc.lat, loc.lon, ZOOM);
    var size = TILE * Math.pow(2, V.zoom - ZOOM);
    block.style.left = (panel.clientWidth / 2 - (1 + t.fx) * size) + 'px';
    block.style.top = (panel.clientHeight / 2 - (1 + t.fy) * size) + 'px';
    block.style.width = block.style.height = (size * 3) + 'px';
    block.style.gridTemplateColumns = block.style.gridTemplateRows = 'repeat(3, ' + size + 'px)';
    Array.prototype.forEach.call(block.children, function (tile) {
      tile.style.width = tile.style.height = tile.style.backgroundSize = size + 'px';
    });
    loadBasemap(el, panel, loc);
  }

  function loadBasemap(el, panel, loc) {
    var t = lonLatToTile(loc.lat, loc.lon, V.zoom);
    var cx = t.x + t.fx, cy = t.y + t.fy;
    var halfW = panel.clientWidth / 2, halfH = panel.clientHeight / 2;
    var box = el.querySelector('.wx-map-tiles');
    var status = el.querySelector('.wx-map-status');
    var generation = V.generation, pending = 0, failed = 0;
    var images = [];
    // Only visible tiles, not a prefetch ring or other zoom levels.
    for (var y = Math.floor(cy - halfH / TILE); y <= Math.floor(cy + halfH / TILE); y++) {
      if (y < 0 || y >= Math.pow(2, V.zoom)) continue;
      for (var x = Math.floor(cx - halfW / TILE); x <= Math.floor(cx + halfW / TILE); x++) {
        var img = new Image();
        img.className = 'wx-map-tile';
        img.alt = '';
        img.style.left = (halfW + (x - cx) * TILE) + 'px';
        img.style.top = (halfH + (y - cy) * TILE) + 'px';
        var wrappedX = (x % Math.pow(2, V.zoom) + Math.pow(2, V.zoom)) % Math.pow(2, V.zoom);
        images.push({ img: img, url: '/api/basemap/' + V.zoom + '/' + wrappedX + '/' + y });
        box.appendChild(img);
        var boundaries = img.cloneNode(false);
        boundaries.className += ' wx-county-tile';
        images.push({ img: boundaries, url: '/api/boundaries/' + V.zoom + '/' + wrappedX + '/' + y });
        box.appendChild(boundaries);
      }
    }
    pending = images.length;
    images.forEach(function (entry) {
      var settled = false;
      function done() {
        if (settled || generation !== V.generation) return;
        settled = true;
        if (!entry.img.naturalWidth) failed++;
        if (--pending === 0) {
          status.hidden = !failed;
          status.textContent = 'Map or boundaries unavailable';
        }
      }
      entry.img.onload = entry.img.onerror = done;
      entry.img.src = entry.url;
      if (entry.img.complete) done();
    });
  }

  // Tiles are proxied by the box: Android 6 lacks the ISRG Root X1 that
  // tilecache.rainviewer.com's chain ends at, so direct loads fail on the frame.
  function radarUrl(frame, x, y) {
    return V.radar.tileBase + frame.path + '/' + ZOOM + '/' + x + '/' + y;
  }

  // Buffer and decode the entire replay before painting or starting its timer.
  // Keep the Images alive while playing so the WebView can reuse decoded tiles.
  function loadRadar(el) {
    var loc = D.weather && D.weather.loc;
    if (!loc || !V.radar || !V.radar.frames.length) return;
    V.frames = V.radar.frames;
    V.bufferedRadar = null;
    V.images = [];
    var tiles = Array.prototype.slice.call(el.querySelectorAll('.wx-tile'));
    var total = V.frames.length * tiles.length;
    var ready = 0, failed = false, generation = V.generation;
    var panel = el.querySelector('.wx-radar');
    var label = el.querySelector('.wx-radar-time');
    var bar = el.querySelector('.wx-radar-bar i');
    panel.setAttribute('aria-busy', 'true');
    function settled(ok) {
      if (generation !== V.generation) return;
      failed = failed || !ok;
      ready++;
      var percent = Math.round(ready / total * 100);
      if (label) label.textContent = 'Loading radar ' + percent + '%';
      if (bar) bar.style.width = percent + '%';
      if (ready !== total) return;
      panel.setAttribute('aria-busy', 'false');
      V.failed = failed;
      if (failed) {
        V.noRain = false;
        var empty = el.querySelector('.wx-radar-empty');
        if (empty) { empty.textContent = 'Radar unavailable'; empty.hidden = false; }
        if (label) label.textContent = 'Radar unavailable';
        if (bar) bar.style.width = '0%';
        return;
      }
      V.bufferedRadar = V.radar;
      paintFrame(el, 0);
      startLoop(el);
    }
    V.frames.forEach(function (frame) {
      tiles.forEach(function (tile) {
        var img = new Image(), handled = false;
        // Both a warm-cache complete check and onload may fire. Decode and
        // count each tile exactly once, including errors.
        function loaded() {
          if (handled || generation !== V.generation) return;
          handled = true;
          if (!img.naturalWidth) { settled(false); return; }
          if (typeof img.decode === 'function') {
            img.decode().then(function () { settled(true); }, function () { settled(false); });
          } else {
            settled(true);
          }
        }
        V.images.push(img);
        img.onload = img.onerror = loaded;
        img.src = radarUrl(frame, +tile.dataset.x, +tile.dataset.y);
        if (img.complete) loaded();
      });
    });
  }

  // The server probes only the location's centre tile, not the whole panel.
  // Missing/failed probes are unknown and must never justify a clear notice.
  function radarNotice(meta) {
    return meta && meta.frames && meta.frames.length &&
      meta.frames.every(function (f) { return f.echo === false; });
  }

  function paintFrame(el, i) {
    if (!V.frames.length) return;
    var f = V.frames[i % V.frames.length];
    Array.prototype.forEach.call(el.querySelectorAll('.wx-tile'), function (tile) {
      tile.style.backgroundImage = 'url("' + radarUrl(f, +tile.dataset.x, +tile.dataset.y) + '")';
    });
    var time = App.date((f.time || 0) * 1000);
    var label = el.querySelector('.wx-radar-time');
    if (label) label.textContent = App.fmt.time(time);
    var bar = el.querySelector('.wx-radar-bar i');
    if (bar) bar.style.width = Math.round((i % V.frames.length) / Math.max(1, V.frames.length - 1) * 100) + '%';
    var empty = el.querySelector('.wx-radar-empty');
    if (empty) {
      if (V.failed) { empty.textContent = 'Radar unavailable'; empty.hidden = false; }
      else { empty.textContent = DRY_NOTICE; empty.hidden = !V.noRain; }
    }
    V.idx = i;
  }

  function startLoop(el) {
    stopLoop();
    V.timer = setInterval(function () {
      if (App.current !== 'weather') return;
      paintFrame(el, (V.idx + 1) % Math.max(1, V.frames.length));
    }, 550);
  }
  function stopLoop() { if (V.timer) { clearInterval(V.timer); V.timer = null; } }
  function loadRadarMeta(key) {
    if (V.radar && V.radarKey === key && Date.now() - V.radarAt < 240000) return Promise.resolve(V.radar);
    return fetch('/api/radar', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (meta) {
      return meta && meta.frames && meta.frames.length ? meta : null;
    }).catch(function () { return null; });
  }

  // ------------------------------------------------------------ render
  function render(el) {
    stopLoop();
    var generation = ++V.generation;
    var loc = D.weather && D.weather.loc;
    var key = loc ? loc.lat + ',' + loc.lon : '';
    var W = w();
    if (!W.t || !W.t.length) {
      el.innerHTML = '<div class="wx"><div class="wx-empty serif">Weather is not available yet.<br><i>Set a location in StartOS, then run Sync Now.</i></div></div>';
      return;
    }
    var location = loc && loc.city;
    if (!location && loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
      location = (loc.name ? loc.name + ' · ' : '') + loc.lat.toFixed(4) + ', ' + loc.lon.toFixed(4);
    }
    if (loc && loc.zip) location = (location ? location + ' · ' : '') + 'ZIP ' + loc.zip;
    el.innerHTML = '<div class="wx">' +
      '<div class="wx-head"><div class="wx-heading"><div class="serif">Weather</div>' +
      '<div class="wx-location">' + App.esc(location || 'Location not set') + '</div></div>' +
      '<div class="label">' + App.fmt.day(App.now()) + ' · ' + App.fmt.month(App.now()) + ' ' + App.now().getDate() + '</div></div>' +
      '<div class="wx-top">' + current() + hourly() + '</div>' +
      '<div class="wx-body">' + forecast() + radarPanel() + '</div>' +
      '</div>';
    el.onclick = function (e) {
      var button = e.target.closest('[data-map-zoom]');
      if (!button || button.disabled) return;
      V.zoom = Math.max(7, Math.min(10, V.zoom + +button.dataset.mapZoom));
      render(el);
    };
    var panel = el.querySelector('.wx-radar');
    if (!panel) return;
    panel.setAttribute('aria-busy', 'true');
    positionRadar(el);
    var empty = panel.querySelector('.wx-radar-empty');
    // Fresh panel: clear state from any previous render (e.g. a prior failure
    // or a different location) before deciding the caption again.
    V.failed = false;
    V.noRain = false;
    if (empty) empty.hidden = true;
    loadRadarMeta(key).then(function (meta) {
      if (generation !== V.generation) return;
      if (!meta) {
        V.failed = true;
        V.noRain = false;
        panel.setAttribute('aria-busy', 'false');
        var label = el.querySelector('.wx-radar-time');
        if (label) label.textContent = 'Radar unavailable';
        if (empty) { empty.textContent = 'Radar unavailable'; empty.hidden = false; }
        return;
      }
      if (V.radar !== meta) V.radarAt = Date.now();
      V.radar = meta;
      V.radarKey = key;
      V.noRain = V.zoom === ZOOM && radarNotice(meta);
      V.failed = false;
      if (empty) {
        empty.hidden = true; // Do not declare clear until the replay finishes loading.
      }
      // Metadata cache hits retain the same location and source-z7 tile grid,
      // even when the map zoom changes. Reuse the fully decoded replay.
      if (V.bufferedRadar === meta) {
        panel.setAttribute('aria-busy', 'false');
        paintFrame(el, V.idx);
        startLoop(el);
      } else {
        loadRadar(el);
      }
    });
  }

  App.register('weather', {
    show: function (el) {
      V.el = el;
      render(el);
    },
    // Rebuild on return so location changes and expired metadata are respected.
    // Tile images remain in the browser cache.
    resume: function (el) {
      V.el = el;
      render(el);
    },
    hide: function () { ++V.generation; stopLoop(); }
  });

  App.on('data', function () { if (App.current === 'weather' && V.el) render(V.el); });
  App.on('minute', function () {
    if (App.current !== 'weather' || !V.el) return;
    // Refresh the clock-sensitive header and hourly strip without reloading radar.
    var head = V.el.querySelector('.wx-head .label');
    if (head) head.textContent = App.fmt.day(App.now()) + ' · ' + App.fmt.month(App.now()) + ' ' + App.now().getDate();
  });
})();
