// Screen lock: pin the dashboard to one section, or lock it entirely.
// Press and hold the floating padlock (bottom-right) for options.
//   Lock to <section>  — stays on that section; touch inside still works.
//   Lock entirely      — stays on the current section; nothing can be edited.
// An optional passcode (SHA-256 in localStorage) guards unlocking, and is
// re-verified before removing or changing it. Lock state survives reboots;
// while locked, idle dimming is disabled.
(function () {
  'use strict';
  var KEY = 'hq.lock.v1';
  var SECTIONS = { home: 'Today', weather: 'Weather', calendar: 'Calendar', tasks: 'Chores', shopping: 'Groceries', photos: 'Photos', vestaboard: 'Vestaboard', control: 'Home' };
  var $ = App.$;

  // ------------------------------------------------------------ state
  var state = { mode: null, section: null, hash: null };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (p.mode === 'section' || p.mode === 'full') state.mode = p.mode;
        state.section = typeof p.section === 'string' ? p.section : null;
        state.hash = typeof p.hash === 'string' ? p.hash : null;
      }
    }
  } catch (e) { /* storage unavailable: run unlocked */ }
  if (!SECTIONS[state.section]) state.section = 'home';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function active() { return state.mode === 'section' || state.mode === 'full'; }
  // Both modes pin the frame to state.section; the difference is editability
  // (the full-lock shield), which apply() handles.
  function allows(name) {
    if (!active()) return true;
    return name === state.section;
  }
  App.lock = { active: active, allows: allows };

  // ------------------------------------------------------------ sha256
  // crypto.subtle needs a secure context, which a plain-http LAN origin is not.
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '', words = [], bitLen = ascii.length * 8;
    var hash = [], k = [], primes = 0, composite = {}, i, j;
    for (var c = 2; primes < 64; c++) {
      if (!composite[c]) {
        for (i = 0; i < 313; i += c) composite[i] = c;
        hash[primes] = (Math.pow(c, .5) * maxWord) | 0;
        k[primes++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return ''; // non-ASCII: caller UTF-8-encodes first
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
    return result;
  }
  function hashOf(s) { return sha256(unescape(encodeURIComponent(s))); }

  // ------------------------------------------------------------ apply state to the page
  var stage = null, shield = null;
  function ensureShield() {
    if (shield) return;
    shield = document.createElement('div');
    shield.className = 'lock-shield'; shield.id = 'lockShield';
    shield.innerHTML =
      '<div class="lock-shield-inner">' +
      '  <div class="lock-badge">' + App.icon('lock', 22) +
      '<span>Screen locked</span>' +
      '<span class="lock-hint">Hold the padlock to unlock</span></div>' +
      '</div>';
    $('#stage').appendChild(shield);
  }
  function apply() {
    stage = stage || $('#stage');
    stage.classList.toggle('is-locked-full', state.mode === 'full');
    stage.classList.toggle('is-locked-section', state.mode === 'section');
    if (state.mode === 'full') ensureShield();
    else if (shield) { shield.remove(); shield = null; }
    // Both modes land the frame on the locked section (also on cold boot).
    if (active() && state.section && App.views[state.section]) App.go(state.section);
    var btn = $('#railLock');
    if (btn) btn.innerHTML = App.icon(active() ? 'lock' : 'unlock', 24);
    save();
  }

  // ------------------------------------------------------------ unlock
  function doUnlock() {
    state.mode = null;
    save();
    apply();
    App.resetIdle(); // idle seconds accumulated while locked; grant a fresh window
    App.toast('Screen unlocked', { icon: 'unlock' });
  }
  function requestUnlock() {
    if (state.hash) passSheet('Enter passcode', 'verify', function (ok) { if (ok) doUnlock(); });
    else doUnlock();
  }

  // ------------------------------------------------------------ passcode sheet
  // mode 'verify': one entry, onDone(true) when it matches the stored hash.
  // mode 'set': entry + re-entry, onDone(hash) with the new hash.
  function passSheet(title, mode, onDone) {
    var first = null, entry = '', closeRef = null;
    function dots() {
      var out = '';
      for (var i = 0; i < Math.max(entry.length, 4); i++) out += '<i' + (i < entry.length ? ' class="on"' : '') + '></i>';
      return out;
    }
    function render(err) {
      var pad = $('#lockPad');
      if (!pad) return;
      pad.querySelector('.lock-dots').innerHTML = dots();
      pad.querySelector('.lock-title').textContent = title + (mode === 'set' && first !== null ? ' · re-enter' : '');
      pad.querySelector('.lock-err').textContent = err || '';
      if (err) {
        var sheet = pad.closest('.sheet');
        sheet.classList.remove('lock-shake');
        void sheet.offsetWidth;
        sheet.classList.add('lock-shake');
      }
    }
    function submit() {
      if (entry.length < 4) { render('At least 4 digits'); return; }
      if (mode === 'set') {
        if (first === null) { first = entry; entry = ''; render(''); return; }
        if (first !== entry) { first = null; entry = ''; render('Passcodes didn’t match — start over'); return; }
        closeRef();
        onDone(hashOf(entry));
      } else {
        if (hashOf(entry) !== state.hash) { entry = ''; render('Wrong passcode'); return; }
        closeRef();
        onDone(true);
      }
    }
    App.sheet(
      '<div class="sheet-pad lock-pad" id="lockPad"><div class="label">Screen lock</div>' +
      '<h2 class="serif sheet-h lock-title">' + title + '</h2>' +
      '<div class="lock-dots"></div>' +
      '<div class="lock-err"></div>' +
      '<div class="lock-grid">' +
      '  <button class="lock-key" data-k="1">1</button><button class="lock-key" data-k="2">2</button><button class="lock-key" data-k="3">3</button>' +
      '  <button class="lock-key" data-k="4">4</button><button class="lock-key" data-k="5">5</button><button class="lock-key" data-k="6">6</button>' +
      '  <button class="lock-key" data-k="7">7</button><button class="lock-key" data-k="8">8</button><button class="lock-key" data-k="9">9</button>' +
      '  <button class="lock-key lock-key--mute" data-k="clear">' + App.icon('x', 26) + '</button>' +
      '  <button class="lock-key" data-k="0">0</button>' +
      '  <button class="lock-key lock-key--solid" data-k="ok">' + App.icon('check', 26) + '</button>' +
      '</div></div>',
      {
        onMount: function (s, close) {
          closeRef = close;
          render('');
          Array.prototype.forEach.call(s.querySelectorAll('.lock-key'), function (b) {
            b.addEventListener('click', function () {
              var k = b.getAttribute('data-k');
              if (k === 'clear') { entry = ''; if (mode === 'set') first = null; render(''); return; }
              if (k === 'ok') { submit(); return; }
              if (entry.length >= 8) return;
              entry += k;
              render('');
            });
          });
        }
      }
    );
  }

  // ------------------------------------------------------------ options sheet (unlocked only)
  function optionsSheet() {
    var cur = SECTIONS[App.current] || App.current;
    var curId = App.current && SECTIONS[App.current] ? App.current : null;
    var rows = '';
    if (curId) rows += '<button class="btn" id="lkPin">Lock to ' + cur + '</button>';
    rows += '<button class="btn" id="lkFull">Lock Entirely</button>';
    rows += '<button class="btn" id="lkPass">' + (state.hash ? 'Change Passcode' : 'Set Passcode') + '</button>';
    if (state.hash) rows += '<button class="btn" id="lkPassClear">Remove Passcode</button>';
    App.sheet(
      '<div class="sheet-pad"><div class="label">Screen lock</div><h2 class="serif sheet-h">Lock options</h2>' +
      '<p class="sheet-p">Lock to a section: the frame stays on it and touch inside still works. Lock entirely: the frame stays on the current section but nothing can be edited or changed.</p>' +
      '<div class="lock-actions">' + rows + '</div></div>',
      {
        onMount: function (s, close) {
          var pin = s.querySelector('#lkPin');
          if (pin) pin.onclick = function () { close(); state.mode = 'section'; state.section = curId; save(); apply(); App.toast('Pinned to ' + cur + ' · hold the padlock to unlock', { icon: 'lock', ms: 6000 }); };
          var full = s.querySelector('#lkFull');
          if (full) full.onclick = function () { close(); state.mode = 'full'; state.section = curId; save(); apply(); App.toast('Locked to ' + cur + ' · nothing can be edited · hold the padlock to unlock', { icon: 'lock', ms: 6000 }); };
          var pass = s.querySelector('#lkPass');
          if (pass) pass.onclick = function () {
            close();
            function setNew() { passSheet('Set new passcode', 'set', function (h) { state.hash = h; save(); App.toast('Passcode saved', { icon: 'lock' }); }); }
            if (state.hash) passSheet('Enter current passcode', 'verify', function (ok) { if (ok) setNew(); });
            else setNew();
          };
          var clear = s.querySelector('#lkPassClear');
          if (clear) clear.onclick = function () {
            close();
            passSheet('Enter current passcode', 'verify', function (ok) {
              if (ok) { state.hash = null; save(); App.toast('Passcode removed', { icon: 'lock' }); }
            });
          };
        }
      }
    );
  }

  // ------------------------------------------------------------ boot wiring
  App.on('ready', function () {
    var btn = $('#railLock');
    if (btn) {
      App.hold(btn, 1200, {
        done: function () { if (active()) requestUnlock(); else optionsSheet(); }
      });
      btn.addEventListener('click', function () {
        if (active()) App.toast('Press and hold the padlock to unlock', { ms: 3000, icon: 'lock' });
      });
    }
    apply();
    // While locked: no ambient/night mode changes (day is always allowed).
    var setMode = App.setMode;
    if (setMode) App.setMode = function (m) { if (active() && m !== 'day') return; return setMode.apply(this, arguments); };
  });
})();
