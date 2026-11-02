// Shopping: tap needed items from the catalog to build a clean list grouped by
// category. The list lives on the box, so it survives reloads and every screen
// sees the same selections.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, store: '', query: '', saveTimer: null, saving: false, printing: false };

  function shopping() { return D.shopping || { stores: [], categories: [], items: [], list: [] }; }
  function categories() { return shopping().categories.length ? shopping().categories : ['Other']; }
  function catalog() { return shopping().items || []; }

  function list() { return D.groceries || []; }
  // All is a view, not a store. Additions there still go to Unspecified.
  function targetStore() { return V.store === null ? '' : V.store; }
  function visible() {
    return list().filter(function (g) { return V.store === null || g.store === V.store; });
  }
  function inList(name) {
    var n = name.toLowerCase();
    return list().filter(function (g) { return g.store === targetStore() && g.name.toLowerCase() === n; })[0];
  }

  function save() {
    clearTimeout(V.saveTimer);
    V.saveTimer = setTimeout(function () {
      var payload = list().map(function (g) {
        return { name: g.name, category: g.cat, store: g.store, qty: g.qty, note: g.note || '', done: false };
      });
      V.saving = true;
      fetch('/api/shopping/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: payload })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function () {
        V.saving = false;
      }).catch(function () {
        V.saving = false;
        App.toast('Could not save the shopping list', { icon: 'cart' });
      });
    }, 400);
  }

  // ------------------------------------------------------------ list rows
  function assignment(g) {
    var stores = shopping().stores || [];
    if (g.store || !stores.length) return '';
    return '<select class="s-assign" data-assign="' + App.esc(g.id) + '" aria-label="Assign ' + App.esc(g.name) + ' to store">' +
      '<option value="">Assign store…</option>' +
      stores.map(function (s) { return '<option value="' + App.esc(s.id) + '">' + App.esc(s.name) + '</option>'; }).join('') +
      '</select>';
  }
  function row(g) {
    return '<div class="s-row" data-id="' + g.id + '">' +
      '<span class="s-name"><b>' + App.esc(g.name) + '</b>' +
      (V.store === null ? '<small>' + App.esc(g.store || 'Unspecified') + '</small>' : '') +
      assignment(g) + '</span>' +
      '<div class="s-qty"><button data-qty="-1" data-id="' + g.id + '" aria-label="Less">' + App.icon('minus', 22) + '</button><span class="num">' + g.qty + '</span><button data-qty="1" data-id="' + g.id + '" aria-label="More">' + App.icon('plus', 22) + '</button></div>' +
      '<button class="s-remove" data-remove="' + g.id + '" aria-label="Remove">' + App.icon('x', 22) + '</button>' +
      '</div>';
  }

  function listHTML() {
    var items = visible();
    if (!items.length) return '<div class="s-empty serif">Nothing on the list yet.<br><i>Tap what you need.</i></div>';
    var order = categories();
    var groups = order.map(function (cat) {
      return { cat: cat, items: items.filter(function (g) { return g.cat === cat; }) };
    }).filter(function (x) { return x.items.length; });
    return groups.map(function (gr) {
      return '<div class="s-cat" data-cat="' + App.esc(gr.cat) + '">' +
        '<div class="s-cat-h"><span class="label">' + App.esc(gr.cat) + '</span><span class="label">' + gr.items.length + '</span></div>' +
        gr.items.map(row).join('') + '</div>';
    }).join('');
  }

  // ------------------------------------------------------------ catalog tiles
  function tile(item) {
    var g = inList(item.name);
    return '<button class="s-item' + (g ? ' is-on' : '') + '" data-add="' + App.esc(item.name) + '">' +
      '<b>' + App.esc(item.name) + '</b>' +
      (g ? '<span>' + App.icon('check', 16) + '×' + g.qty + '</span>' : '<span>' + App.icon('plus', 16) + '</span>') +
      '</button>';
  }

  function catalogHTML() {
    var q = V.query.trim().toLowerCase();
    var items = catalog();
    if (q) {
      var matches = items.filter(function (item) { return item.name.toLowerCase().indexOf(q) > -1; });
      var exact = items.some(function (item) { return item.name.toLowerCase() === q; });
      return '<div class="label">Matches</div><div class="s-tiles">' + matches.map(tile).join('') +
        (exact ? '' : '<button class="s-item s-item--new" data-add="' + App.esc(V.query.trim()) + '"><b>Add “' + App.esc(V.query.trim()) + '”</b><span>' + App.icon('plus', 16) + '</span></button>') +
        '</div>';
    }
    if (!items.length) return '<div class="s-catalog-empty">No catalog items are enabled. In StartOS, turn on <b>Use prepopulated defaults</b> and save <b>Edit Groceries</b>, or add your own items.</div>';
    var usuals = items.filter(function (item) { return item.usual; });
    var groups = categories().map(function (cat) {
      return { cat: cat, items: items.filter(function (item) { return item.category === cat; }) };
    }).filter(function (x) { return x.items.length; });
    return (usuals.length ? '<div class="label">Usuals · tap to add</div><div class="s-tiles s-tiles--usuals">' + usuals.map(tile).join('') + '</div>' : '') +
      groups.map(function (gr) {
        return '<div class="s-cat-tiles"><div class="label">' + App.esc(gr.cat) + '</div><div class="s-tiles">' + gr.items.map(tile).join('') + '</div></div>';
      }).join('');
  }

  // ------------------------------------------------------------ mutations
  function newId() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function add(name) {
    name = name.trim();
    if (!name) return;
    var g = inList(name);
    if (g) {
      g.qty++;
    } else {
      var item = catalog().filter(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })[0];
      g = {
        id: newId(),
        name: item ? item.name : name.charAt(0).toUpperCase() + name.slice(1),
        cat: item ? item.category : 'Other',
        qty: 1,
        store: targetStore(),
        done: false,
        note: ''
      };
      D.groceries.push(g);
    }
    var hadQuery = !!V.query.trim();
    V.query = '';
    var input = V.el.querySelector('.s-input');
    if (input) input.value = '';
    paintList();
    paintCatalog();
    save();
    App.emit('data');
    App.toast('<b>' + App.esc(g.name) + '</b> added', { icon: 'cart', ms: 2000 });
    if (hadQuery && input) input.focus();
  }

  function remove(id) {
    var g = list().filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    D.groceries = list().filter(function (x) { return x.id !== id; });
    paintList();
    paintCatalog();
    save();
    App.emit('data');
    App.toast('<b>' + App.esc(g.name) + '</b> removed', { icon: 'cart', ms: 2000 });
  }

  function setQty(id, delta) {
    var g = list().filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    g.qty = Math.max(1, g.qty + delta);
    paintList();
    paintCatalog();
    save();
    App.emit('data');
  }

  function assignStore(id, store) {
    var g = list().filter(function (x) { return x.id === id; })[0];
    if (!g || g.store || !(shopping().stores || []).some(function (s) { return s.id === store; })) return;
    var existing = list().filter(function (x) {
      return x !== g && x.store === store && x.name.toLowerCase() === g.name.toLowerCase();
    })[0];
    if (existing) {
      existing.qty += g.qty;
      if (g.note && existing.note !== g.note) existing.note = existing.note ? existing.note + '; ' + g.note : g.note;
      D.groceries = list().filter(function (x) { return x.id !== id; });
    } else {
      g.store = store;
    }
    paintList();
    paintCatalog();
    save();
    App.emit('data');
    App.toast('<b>' + App.esc(g.name) + '</b> assigned to ' + App.esc(store), { icon: 'cart', ms: 2000 });
  }

  // ------------------------------------------------------------ printing + clearing
  function confirmClear() {
    App.sheet(
      '<div class="sheet-pad"><div class="label">Groceries</div>' +
      '<h2 class="serif sheet-h">Clear the whole list?</h2>' +
      '<p class="sheet-p">This removes every item from every store. It cannot be undone.</p>' +
      '<div class="sheet-actions"><button class="btn" data-cancel>Cancel</button>' +
      '<button class="btn btn--solid" data-confirm>Clear all</button></div></div>',
      {
        onMount: function (sheet, close) {
          sheet.querySelector('[data-cancel]').onclick = close;
          sheet.querySelector('[data-confirm]').onclick = function () {
            close();
            D.groceries = [];
            paintList();
            paintCatalog();
            save();
            App.emit('data');
            App.toast('Groceries cleared', { icon: 'cart' });
          };
        },
      },
    );
  }


  function sendPrint() {
    if (V.printing) return;
    V.printing = true;
    var button = V.el.querySelector('[data-print]');
    button.disabled = true;
    button.textContent = 'Printing…';
    fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (result) {
      if (!result.ok || !result.data.ok) throw new Error(result.data.error || 'Print failed');
      App.toast('Groceries sent to printer', { icon: 'printer' });
    }).catch(function (err) {
      App.toast('Could not print: ' + App.esc(err.message), { icon: 'printer', ms: 6000 });
    }).then(function () {
      V.printing = false;
      var currentButton = V.el.querySelector('[data-print]');
      currentButton.disabled = false;
      currentButton.textContent = 'Print';
    });
  }

  // ------------------------------------------------------------ rendering
  function paintList() {
    var l = V.el.querySelector('.s-list');
    var st = l.scrollTop;
    l.innerHTML = listHTML();
    l.scrollTop = st;
    paintHead();
  }
  function paintCatalog() { V.el.querySelector('.s-catalog').innerHTML = catalogHTML(); }
  function paintHead() {
    var all = list();
    var chips = [{ id: null, name: 'All' }, { id: '', name: 'Unspecified' }].concat(shopping().stores || []);
    V.el.querySelector('.s-count').innerHTML = '<span class="num">' + visible().length + '</span> to get';
    V.el.querySelector('.s-stores').innerHTML = chips.map(function (s) {
      var n = s.id === null ? all.length : all.filter(function (g) { return g.store === s.id; }).length;
      var attr = s.id === null ? 'data-all' : 'data-store="' + App.esc(s.id) + '"';
      return '<button class="' + (V.store === s.id ? 'is-on' : '') + '" ' + attr + '>' + App.esc(s.name) + ' <span class="num">' + n + '</span></button>';
    }).join('');
  }

  function render() {
    V.el.innerHTML = '<div class="shop">' +
      '<header class="s-head"><div><div class="label">Shared list</div><h1 class="serif">Groceries</h1></div><div class="s-count"></div><div class="seg s-stores"></div></header>' +
      '<div class="s-list"></div>' +
      '<aside class="s-side">' +
      '  <div class="s-tools">' +
      '    <button class="s-tool" data-print' + (V.printing ? ' disabled' : '') + '>' + (V.printing ? 'Printing…' : 'Print') + '</button>' +
      '    <button class="s-tool s-tool--danger" data-clear>Clear all</button>' +
      '  </div>' +
      '  <div class="s-add">' +
      '    <label class="s-input-wrap">' + App.icon('plus', 22) + '<input class="s-input" placeholder="Add an item…" aria-label="Add an item" autocomplete="off" enterkeyhint="done"></label>' +
      '  </div>' +
      '  <div class="s-catalog"></div>' +
      '</aside></div>';
    var input = V.el.querySelector('.s-input');
    input.value = V.query;
    input.addEventListener('input', function () { V.query = input.value; paintCatalog(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && input.value.trim()) add(input.value); });
    paintList();
    paintCatalog();
  }

  function onClick(e) {
    var t;
    if (e.target.closest('[data-print]')) return sendPrint();
    if (e.target.closest('[data-clear]')) return confirmClear();
    if ((t = e.target.closest('[data-add]'))) return add(t.dataset.add);
    if ((t = e.target.closest('[data-remove]'))) return remove(t.dataset.remove);
    if ((t = e.target.closest('[data-qty]'))) return setQty(t.dataset.id, +t.dataset.qty);
    if (e.target.closest('[data-all]')) { V.store = null; paintList(); paintCatalog(); return; }
    if ((t = e.target.closest('[data-store]'))) { V.store = t.dataset.store; paintList(); paintCatalog(); return; }
  }

  function onChange(e) {
    var select = e.target.closest('[data-assign]');
    if (select) assignStore(select.dataset.assign, select.value);
  }

  App.register('shopping', {
    show: function (el) {
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
      render();
    },
    resume: function () {
      if (V.el) { paintList(); paintCatalog(); }
    }
  });
  // Server data can arrive after the view is built; repaint while visible.
  App.on('data', function () {
    if (App.current !== 'shopping' || !V.el) return;
    paintList();
    paintCatalog();
  });
})();
