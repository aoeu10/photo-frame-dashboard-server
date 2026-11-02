// Photo slideshow used by the Photos view, ambient mode and the home tile.
(function () {
  'use strict';
  var D = window.DATA;

  function src(p, big) {
    // Server photos stream straight from Apple's CDN (manifest-provided
    // renditions: display + thumbnail); mock entries fall back to picsum.
    if (p.src) return big ? p.src : (p.thumbsrc || p.src);
    var w = p.o === 'p' ? 800 : 1600, h = p.o === 'p' ? 1200 : 1000;
    if (!big) { w = Math.round(w / 2); h = Math.round(h / 2); }
    return App.img(p.seed, w, h);
  }
  App.photoSrc = src;

  function parseDate(p) {
    if (!p.date) return null;
    var a = p.date.split('-'), d = App.date(+a[0], +a[1] - 1, +a[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  App.photoMeta = function (p) {
    var d = parseDate(p), now = App.now();
    if (!d) return {
      date: 'Date taken unavailable', monthYear: 'Date taken unavailable',
      kicker: 'Shared album', onThisDay: false, knownDate: false,
      place: p.place, from: App.person(p.from)
    };
    var years = now.getFullYear() - d.getFullYear();
    var onThisDay = years > 0 && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var kicker = App.sameDay(d, now) ? 'Taken today' : (years > 0 ? 'Taken ' + years + (years === 1 ? ' year ago' : ' years ago') : 'Taken this year');
    return {
      date: App.fmt.month(d) + ' ' + d.getDate() + ', ' + d.getFullYear(),
      monthYear: App.fmt.month(d) + ' ' + d.getFullYear(),
      kicker: kicker, onThisDay: onThisDay, knownDate: true, place: p.place, from: App.person(p.from)
    };
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function caption(ps, size) {
    var m = App.photoMeta(ps[0]);
    return '<div class="cap cap--' + (size || 'l') + '">' +
      '<div class="cap-kicker">' + (m.onThisDay ? '<b>On this day</b> · ' : '') + m.kicker + ' · ' + App.esc(m.place) + '</div>' +
      '<div class="cap-date serif">' + (ps.length > 1 ? m.monthYear : m.date) + '</div>' +
      '</div>';
  }
  function kb(p, still) {
    var dx = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2.5) + '%';
    var dy = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.5) + '%';
    return '<div class="kb' + (still ? ' kb--still' : '') + '" style="--dx:' + dx + ';--dy:' + dy + '"><img src="' + src(p, true) + '" alt=""></div>';
  }

  var BUILD = {
    cover: function (ps, o) {
      var p = ps[0];
      if (p.o === 'p') {
        return '<div class="slide slide--fit"><img class="blurfill" src="' + src(p) + '" alt=""><img class="fitimg" src="' + src(p, true) + '" alt="">' + (o.captions ? caption(ps) : '') + '</div>';
      }
      return '<div class="slide slide--cover">' + kb(p) + (o.captions ? caption(ps) : '') + '</div>';
    },
    pair: function (ps, o) {
      return '<div class="slide slide--pair"><div class="pane">' + kb(ps[0], true) + '</div><div class="pane">' + kb(ps[1], true) + '</div>' + (o.captions ? caption(ps, 'm') : '') + '</div>';
    },
    collage: function (ps, o) {
      return '<div class="slide slide--collage"><div class="pane pane--a">' + kb(ps[0], true) + '</div><div class="pane pane--b">' + kb(ps[1], true) + '</div><div class="pane pane--c">' + kb(ps[2], true) + '</div>' + (o.captions ? caption(ps, 'm') : '') + '</div>';
    },
    polaroid: function (ps) {
      var p = ps[0], m = App.photoMeta(p), rot = (Math.random() * 5 - 2.5).toFixed(1);
      return '<div class="slide slide--polaroid"><img class="blurfill" src="' + src(p) + '" alt="">' +
        '<figure class="polaroid polaroid--' + p.o + '" style="transform:rotate(' + rot + 'deg)"><div class="polaroid-img"><img src="' + src(p, true) + '" alt=""></div>' +
        '<figcaption class="serif"><i>' + App.esc(m.place) + ', ' + m.monthYear + '</i></figcaption></figure></div>';
    }
  };

  App.Slideshow = function (el, opts) {
    this.el = el;
    this.o = Object.assign({ layout: 'auto', interval: 15000, captions: true }, opts || {});
    this.queue = [];
    this.history = [];
    this.count = 0;
    this.timer = null;
    this.current = null;
    this.source = D.photos;
    var self = this;
    App.on('data', function () {
      if (self.source === D.photos) return;
      var running = self.timer !== null;
      self.syncSource();
      if (running) self.next();
    });
  };
  var S = App.Slideshow.prototype;

  S.syncSource = function () {
    if (this.source === D.photos) return;
    this.source = D.photos;
    this.queue = [];
    this.history = [];
    this.count = 0;
    this.current = null;
    this.el.innerHTML = '';
  };

  S.refill = function () {
    var q = D.photos.slice();
    // On-this-day photos always come first in a fresh cycle
    shuffle(q).sort(function (a, b) { return (App.photoMeta(b).onThisDay ? 1 : 0) - (App.photoMeta(a).onThisDay ? 1 : 0); });
    this.queue = q;
  };
  S.take = function (pred) {
    if (!this.queue.length) this.refill();
    for (var i = 0; i < this.queue.length; i++) if (!pred || pred(this.queue[i])) return this.queue.splice(i, 1)[0];
    return null;
  };
  S.pick = function () {
    this.syncSource();
    var layout = this.o.layout, n = this.count++;
    var first = this.take();
    if (!first) return null;
    var self = this;
    function sibling(pred) {
      return self.take(pred) || D.photos.filter(function (x) { return x !== first && pred(x); })[0];
    }
    if (layout === 'auto') {
      if (first.o === 'p') layout = D.photos.some(function (x) { return x !== first && x.tag === first.tag; }) ? 'pair' : 'polaroid';
      else layout = n % 5 === 3 ? 'collage' : n % 5 === 4 ? 'polaroid' : 'cover';
    }
    var ps = [first];
    if (layout === 'pair') {
      if (first.o !== 'p') { first = sibling(function (x) { return x.o === 'p'; }) || first; ps = [first]; }
      var partner = first.o === 'p' && (sibling(function (x) { return x !== first && x.o === 'p' && x.tag === first.tag; }) || sibling(function (x) { return x !== first && x.o === 'p'; }));
      if (partner) ps.push(partner);
      else layout = 'cover';
    }
    if (layout === 'collage') {
      var second = sibling(function (x) { return x !== first; });
      if (second) ps.push(second);
      var third = sibling(function (x) { return ps.indexOf(x) < 0; });
      if (third) ps.push(third);
      if (ps.length < 3) { layout = 'cover'; ps = [first]; }
    }
    return { layout: layout, photos: ps };
  };

  S.render = function (slide) {
    var self = this;
    this.current = slide;
    var wrap = document.createElement('div');
    wrap.innerHTML = BUILD[slide.layout](slide.photos, this.o);
    var node = wrap.firstChild;
    node.style.opacity = '0';
    // Fallback look if images can't load (offline)
    Array.prototype.forEach.call(node.querySelectorAll('img'), function (im) {
      im.addEventListener('error', function () { im.classList.add('is-broken'); });
    });
    var old = Array.prototype.slice.call(this.el.children);
    this.el.appendChild(node);
    var first = node.querySelector('img:not(.blurfill)');
    var shown = false;
    function show() {
      if (shown) return; shown = true;
      node.classList.add('is-in');
      node.style.opacity = '';
      old.forEach(function (o) { o.remove(); });
    }
    if (first && !first.complete) { first.addEventListener('load', show); first.addEventListener('error', show); setTimeout(show, 2500); }
    else show();
    if (this.o.onChange) this.o.onChange(slide);
  };

  S.next = function () {
    var s = this.pick();
    if (!s) {
      this.current = null;
      this.el.innerHTML = '<div class="slide slide--empty"><div><h2 class="serif">No photos available</h2><p>Check your public shared album and run Sync Now in StartOS.</p></div></div>';
      if (this.o.onChange) this.o.onChange(null);
      this.restart();
      return;
    }
    if (this.current) this.history.push(this.current);
    this.render(s);
    this.restart();
  };
  S.prev = function () {
    this.syncSource();
    if (!this.history.length) return;
    this.render(this.history.pop());
    this.restart();
  };
  S.setLayout = function (l) { this.o.layout = l; this.next(); };
  S.restart = function () {
    var self = this;
    clearInterval(this.timer);
    this.timer = setInterval(function () { self.next(); }, this.o.interval);
  };
  S.start = function () { this.syncSource(); if (!this.current) this.next(); else this.restart(); };
  S.stop = function () { clearInterval(this.timer); this.timer = null; };
})();
