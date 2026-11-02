// Vestaboard: draw directly on the board grid, or compose a VBML message.
// The Local API key and network request stay in the StartOS service.
(function () {
  'use strict';
  var V = {
    el: null, rows: 6, cols: 22, board: 'flagship', characters: null,
    selected: 1, mode: 'draw', template: 'HELLO\nWORLD', justify: 'left',
    align: 'top', json: '', status: null, loading: false, busy: false,
    painting: false, dirty: false, history: [], future: [], bound: false, loadedAt: 0
  };

  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  var PUNCTUATION = ['!', '@', '#', '$', '(', ')', '-', '+', '&', '=', ';', ':', "'", '"', '%', ',', '.', '/', '?'];
  var COLORS = [
    [63, 'Red', '#D8321F'], [64, 'Orange', '#FF9500'],
    [65, 'Yellow', '#FFC45C'], [66, 'Green', '#00A36C'],
    [67, 'Blue', '#2D5BFF'], [68, 'Violet', '#7B4DFF'],
    [69, 'White', '#FFFFFF'], [70, 'Black', '#111111']
  ];
  var REVERSE = {};
  LETTERS.forEach(function (letter, index) { REVERSE[letter] = index + 1; });
  NUMBERS.forEach(function (digit, index) { REVERSE[digit] = index === 9 ? 36 : 27 + index; });
  PUNCTUATION.forEach(function (character) {
    REVERSE[character] = { '!': 37, '@': 38, '#': 39, '$': 40, '(': 41, ')': 42,
      '-': 44, '+': 46, '&': 47, '=': 48, ';': 49, ':': 50, "'": 52, '"': 53,
      '%': 54, ',': 55, '.': 56, '/': 59, '?': 60 }[character];
  });

  function blank() {
    var matrix = [];
    for (var row = 0; row < V.rows; row++) matrix.push(new Array(V.cols).fill(0));
    return matrix;
  }

  function clone(matrix) {
    return matrix.map(function (row) { return row.slice(); });
  }

  function isColor(code) { return code >= 63 && code <= 70; }

  function colorFor(code) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0] === code) return COLORS[i][2];
    return '';
  }

  function codeChar(code) {
    if (!code) return '';
    if (code >= 1 && code <= 26) return LETTERS[code - 1];
    if (code === 27) return '1';
    if (code >= 28 && code <= 35) return String(code - 26);
    if (code === 36) return '0';
    if (code === 37) return '!';
    if (code === 38) return '@';
    if (code === 39) return '#';
    if (code === 40) return '$';
    if (code === 41) return '(';
    if (code === 42) return ')';
    if (code === 44) return '-';
    if (code === 46) return '+';
    if (code === 47) return '&';
    if (code === 48) return '=';
    if (code === 49) return ';';
    if (code === 50) return ':';
    if (code === 52) return "'";
    if (code === 53) return '"';
    if (code === 54) return '%';
    if (code === 55) return ',';
    if (code === 56) return '.';
    if (code === 59) return '/';
    if (code === 60) return '?';
    if (code === 62) return V.rows === 3 ? '♥' : '°';
    return '';
  }

  function boardName() {
    return V.board === 'note' ? 'Note' : 'Flagship';
  }

  function statusHTML() {
    if (V.loading) return '<span class="vb-dot is-wait"></span>Checking board…';
    if (!V.status) return '<span class="vb-dot"></span>Waiting for the service…';
    if (V.status.error) {
      return '<span class="vb-dot is-off"></span>' +
        (V.status.configured ? 'Unreachable' : 'Service unavailable');
    }
    if (!V.status.configured) {
      return '<span class="vb-dot is-off"></span>Not configured';
    }
    if (V.status.reachable) {
      return '<span class="vb-dot is-on"></span>Connected · ' + boardName() + ' ' + V.rows + '×' + V.cols;
    }
    return '<span class="vb-dot is-off"></span>Unreachable';
  }

  function hintHTML() {
    if (V.status && V.status.error) {
      return '<span class="vb-error">' + App.esc(V.status.error) + '</span>';
    }
    if (!V.status || !V.status.configured) {
      return 'Configure the board in StartOS → Actions &amp; Config → Vestaboard Settings. ' +
        'The frame only needs the board size and current message; the Local API key stays on the server.';
    }
    return 'Draw with the palette, or use VBML for centered text and color blocks. Send when it looks right.';
  }

  function keyHTML(code, label, color) {
    if (color) {
      return '<button class="vb-key vb-key--color' + (V.selected === code ? ' is-on' : '') +
        '" data-code="' + code + '" style="--swatch:' + color + '" aria-label="' + App.esc(label) + '"></button>';
    }
    return '<button class="vb-key' + (code === 0 ? ' vb-key--blank' : '') +
      (V.selected === code ? ' is-on' : '') + '" data-code="' + code + '">' + App.esc(label) + '</button>';
  }

  function paletteHTML() {
    var html = '<div class="vb-palette">';
    html += '<div class="label">Letters</div><div class="vb-keys">' +
      LETTERS.map(function (letter) { return keyHTML(REVERSE[letter], letter); }).join('') + '</div>';
    html += '<div class="label">Numbers</div><div class="vb-keys">' +
      NUMBERS.map(function (digit) { return keyHTML(REVERSE[digit], digit); }).join('') + '</div>';
    html += '<div class="label">Punctuation</div><div class="vb-keys">' +
      PUNCTUATION.map(function (character) { return keyHTML(REVERSE[character], character); }).join('') + '</div>';
    html += '<div class="label">Colors</div><div class="vb-keys">' +
      COLORS.map(function (item) { return keyHTML(item[0], item[1], item[2]); }).join('') + '</div>';
    html += '<div class="label">Special</div><div class="vb-keys">' +
      keyHTML(0, 'Blank') + keyHTML(62, V.rows === 3 ? '♥' : '°') + '</div>';
    html += '</div>';
    return html;
  }

  function options(values, current) {
    return values.map(function (value) {
      return '<option value="' + value[0] + '"' + (value[0] === current ? ' selected' : '') + '>' +
        value[1] + '</option>';
    }).join('');
  }

  function vbmlHTML() {
    return '<div class="vb-vbml">' +
      '<div class="label">VBML template</div>' +
      '<textarea class="vb-template" spellcheck="false" placeholder="HELLO\nWORLD">' + App.esc(V.template) + '</textarea>' +
      '<div class="vb-options">' +
        '<label>Justify<select class="vb-justify">' +
          options([['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justified', 'Justified']], V.justify) +
        '</select></label>' +
        '<label>Align<select class="vb-align">' +
          options([['top', 'Top'], ['center', 'Middle'], ['bottom', 'Bottom'], ['justified', 'Justified']], V.align) +
        '</select></label>' +
      '</div>' +
      '<details class="vb-advanced"><summary>Advanced VBML JSON</summary>' +
        '<textarea class="vb-json" spellcheck="false" placeholder=\'{"components":[{"template":"HELLO","style":{"justify":"center"}}]}\'>' +
          App.esc(V.json) + '</textarea>' +
      '</details>' +
      '<p class="vb-note">Use <code>{63}</code>–<code>{70}</code> for color blocks, <code>{{name}}</code> for props, and a new line for a new row.</p>' +
      '<button class="vb-preview" data-preview>Preview VBML</button>' +
      '</div>';
  }

  function renderBoard() {
    var board = V.el && V.el.querySelector('#vbBoard');
    if (!board) return;
    var cell = V.cols > 15 ? 33 : 44;
    board.style.setProperty('--cols', V.cols);
    board.style.setProperty('--cell', cell + 'px');
    board.style.setProperty('--cell-font', (V.cols > 15 ? 22 : 28) + 'px');
    var html = '';
    for (var row = 0; row < V.rows; row++) {
      for (var col = 0; col < V.cols; col++) {
        var code = V.characters[row][col];
        var color = colorFor(code);
        html += '<div class="vb-cell' + (isColor(code) ? ' is-color' : '') + '"' +
          ' data-r="' + row + '" data-c="' + col + '"' +
          (color ? ' style="background:' + color + '"' : '') + '>' +
          App.esc(codeChar(code)) + '</div>';
      }
    }
    board.innerHTML = html;
  }

  function renderSide() {
    var side = V.el && V.el.querySelector('#vbSide');
    if (!side) return;
    side.innerHTML = V.mode === 'vbml' ? vbmlHTML() : paletteHTML();
    if (V.mode === 'vbml') {
      var template = side.querySelector('.vb-template');
      var json = side.querySelector('.vb-json');
      template.addEventListener('input', function () { V.template = template.value; });
      json.addEventListener('input', function () { V.json = json.value; });
      side.querySelector('.vb-justify').addEventListener('change', function (event) {
        V.justify = event.target.value;
      });
      side.querySelector('.vb-align').addEventListener('change', function (event) {
        V.align = event.target.value;
      });
    }
  }

  function updateTabs() {
    if (!V.el) return;
    App.$$('[data-tab]', V.el).forEach(function (button) {
      button.classList.toggle('is-on', button.dataset.tab === V.mode);
    });
  }

  function updateStatus() {
    if (!V.el) return;
    var status = V.el.querySelector('#vbStatus');
    var hint = V.el.querySelector('#vbHint');
    if (status) status.innerHTML = statusHTML();
    if (hint) hint.innerHTML = hintHTML();
  }

  function updateTools() {
    if (!V.el) return;
    var undo = V.el.querySelector('[data-tool="undo"]');
    var redo = V.el.querySelector('[data-tool="redo"]');
    var send = V.el.querySelector('[data-send]');
    if (undo) undo.disabled = !V.history.length;
    if (redo) redo.disabled = !V.future.length;
    if (send) {
      send.disabled = V.busy || !(V.status && V.status.configured);
      send.textContent = V.busy ? 'Sending…' : 'Send';
    }
  }

  function render() {
    if (!V.el) return;
    V.el.innerHTML = '<div class="vb">' +
      '<header class="vb-head">' +
        '<div class="vb-title"><div class="label">Local API</div><h1 class="serif">Vestaboard</h1></div>' +
        '<div class="vb-status" id="vbStatus"></div>' +
        '<div class="seg vb-tabs">' +
          '<button data-tab="draw" class="' + (V.mode === 'draw' ? 'is-on' : '') + '">Draw</button>' +
          '<button data-tab="vbml" class="' + (V.mode === 'vbml' ? 'is-on' : '') + '">VBML</button>' +
        '</div>' +
        '<button class="vb-send" data-send>Send</button>' +
      '</header>' +
      '<div class="vb-body">' +
        '<div class="vb-stage"><div class="vb-board" id="vbBoard"></div></div>' +
        '<div class="vb-side" id="vbSide"></div>' +
      '</div>' +
      '<div class="vb-tools">' +
        '<button data-tool="undo">Undo</button>' +
        '<button data-tool="redo">Redo</button>' +
        '<button data-tool="clear">Clear</button>' +
        '<button data-tool="fill">Fill</button>' +
        '<button data-tool="refresh">Refresh</button>' +
        '<span class="vb-hint" id="vbHint"></span>' +
      '</div>' +
    '</div>';
    renderBoard();
    renderSide();
    updateStatus();
    updateTools();
  }

  function setCharacters(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== V.rows ||
        !matrix.every(function (row) { return Array.isArray(row) && row.length === V.cols; })) {
      V.characters = blank();
    } else {
      V.characters = clone(matrix);
    }
    renderBoard();
  }

  function pushHistory() {
    V.history.push(clone(V.characters));
    if (V.history.length > 50) V.history.shift();
    V.future = [];
    V.dirty = true;
    updateTools();
  }

  function paintCell(cell) {
    var row = Number(cell.dataset.r), col = Number(cell.dataset.c);
    if (!V.characters || isNaN(row) || isNaN(col)) return;
    V.characters[row][col] = V.selected;
    var color = colorFor(V.selected);
    cell.className = 'vb-cell' + (isColor(V.selected) ? ' is-color' : '');
    cell.style.background = color || '';
    cell.textContent = codeChar(V.selected);
  }

  function beginStroke(cell) {
    if (V.painting) return;
    V.painting = true;
    pushHistory();
    paintCell(cell);
  }

  function endStroke() {
    V.painting = false;
  }

  function loadStatus(force) {
    if (force) V.dirty = false;
    V.loading = true;
    updateStatus();
    fetch('/api/vestaboard', { cache: 'no-store' })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var changed = V.rows !== (data.rows || 6) || V.cols !== (data.cols || 22);
        V.status = data;
        V.rows = data.rows || 6;
        V.cols = data.cols || 22;
        V.board = data.board || 'flagship';
        if (changed) {
          V.history = [];
          V.future = [];
          V.dirty = false;
          setCharacters(blank());
        } else if (!V.dirty) {
          if (data.message) setCharacters(data.message);
          else if (!data.configured || !V.characters || V.characters.length !== V.rows ||
                   V.characters[0].length !== V.cols) setCharacters(blank());
        }
        V.loadedAt = Date.now();
        V.loading = false;
        render();
      })
      .catch(function () {
        V.status = { configured: false, reachable: false, error: 'Cannot reach the dashboard service.' };
        V.loading = false;
        updateStatus();
        updateTools();
      });
  }

  function buildVbml() {
    if (V.json.trim()) {
      try {
        return JSON.parse(V.json);
      } catch (error) {
        throw new Error('Advanced VBML JSON is invalid: ' + error.message);
      }
    }
    return {
      components: [{
        template: V.template,
        style: { justify: V.justify, align: V.align }
      }]
    };
  }

  function setBusy(busy) {
    V.busy = busy;
    updateTools();
  }

  function fail(error) {
    setBusy(false);
    if (V.status) V.status.error = String(error.message || error);
    updateStatus();
    App.toast(App.esc(String(error.message || error)), { tone: 'alert', ms: 5000, icon: 'x' });
  }

  function preview() {
    var payload;
    try {
      payload = buildVbml();
    } catch (error) {
      fail(error);
      return;
    }
    setBusy(true);
    fetch('/api/vestaboard/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vbml: payload })
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data.ok) throw new Error(data.error || 'VBML preview failed.');
        return data;
      });
    }).then(function (data) {
      setCharacters(data.characters);
      V.dirty = true;
      setBusy(false);
      App.toast('VBML preview updated', { icon: 'check' });
    }).catch(fail);
  }

  function send() {
    var body;
    try {
      body = V.mode === 'vbml' ? { vbml: buildVbml() } : { characters: V.characters };
    } catch (error) {
      fail(error);
      return;
    }
    setBusy(true);
    fetch('/api/vestaboard/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data.ok) throw new Error(data.error || 'Send failed.');
        return data;
      });
    }).then(function (data) {
      setCharacters(data.characters);
      V.dirty = false;
      V.status.reachable = true;
      V.status.error = '';
      setBusy(false);
      updateStatus();
      App.toast('Sent to Vestaboard', { icon: 'check', ms: 3000 });
    }).catch(fail);
  }

  function undo() {
    if (!V.history.length) return;
    V.future.push(clone(V.characters));
    V.characters = V.history.pop();
    V.dirty = true;
    renderBoard();
    updateTools();
  }

  function redo() {
    if (!V.future.length) return;
    V.history.push(clone(V.characters));
    V.characters = V.future.pop();
    V.dirty = true;
    renderBoard();
    updateTools();
  }

  function clearBoard() {
    pushHistory();
    V.characters = blank();
    renderBoard();
  }

  function fillBoard() {
    pushHistory();
    for (var row = 0; row < V.rows; row++) {
      for (var col = 0; col < V.cols; col++) V.characters[row][col] = V.selected;
    }
    renderBoard();
  }

  function onClick(event) {
    var button = event.target.closest('button');
    if (!button || !V.el.contains(button)) return;
    if (button.dataset.tab) {
      V.mode = button.dataset.tab;
      updateTabs();
      renderSide();
      return;
    }
    if (button.dataset.code !== undefined) {
      V.selected = Number(button.dataset.code);
      App.$$('[data-code]', V.el).forEach(function (key) {
        key.classList.toggle('is-on', Number(key.dataset.code) === V.selected);
      });
      return;
    }
    if (button.dataset.send !== undefined) return send();
    if (button.dataset.preview !== undefined) return preview();
    var tool = button.dataset.tool;
    if (tool === 'undo') undo();
    else if (tool === 'redo') redo();
    else if (tool === 'clear') clearBoard();
    else if (tool === 'fill') fillBoard();
    else if (tool === 'refresh') loadStatus(true);
  }

  function pointerDown(event) {
    var cell = event.target.closest('.vb-cell');
    if (!cell || !V.el.contains(cell)) return;
    event.preventDefault();
    beginStroke(cell);
  }

  function pointerMove(event) {
    if (!V.painting) return;
    var target = document.elementFromPoint(event.clientX, event.clientY);
    var cell = target && target.closest ? target.closest('.vb-cell') : null;
    if (cell && V.el.contains(cell)) paintCell(cell);
  }

  function bind() {
    if (V.bound) return;
    V.bound = true;
    V.el.addEventListener('click', onClick);
    V.el.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', endStroke);
    window.addEventListener('pointercancel', endStroke);
  }

  App.register('vestaboard', {
    show: function (el) {
      V.el = el;
      bind();
      if (!V.characters) V.characters = blank();
      render();
      loadStatus();
    },
    resume: function (el) {
      V.el = el;
      bind();
      if (Date.now() - V.loadedAt > 15000) loadStatus();
    },
    hide: function () { endStroke(); }
  });
})();
