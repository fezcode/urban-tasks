// Self-contained skeuomorphic corkboard rendered inside a WebView.
//
// The page is fully static (no string interpolation) — all data arrives at
// runtime via window.__setBoard({cards, connections, tasks}). User actions are
// posted back to React Native via window.ReactNativeWebView.postMessage as
// {type, ...} messages: move | connect | relabel | disconnect | unpin | open.
//
// Geometry + interaction mirror the web Pinboard (frontend/src/components/Pinboard.tsx):
// pushpins are the string anchors (top-center), card body drags, pinch to zoom,
// drag-from-pin or tap-to-arm to connect.

export const PINBOARD_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  * { box-sizing: border-box; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; overflow: hidden; font-family: -apple-system, Roboto, system-ui, sans-serif; }
  #board {
    position: absolute; inset: 0; overflow: hidden; touch-action: none;
    background-color: #c39a5c;
    background-image:
      radial-gradient(circle at 18% 22%, rgba(0,0,0,0.10) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 62% 44%, rgba(0,0,0,0.08) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 38% 78%, rgba(255,255,255,0.10) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 82% 64%, rgba(0,0,0,0.07) 0 1px, transparent 2px),
      radial-gradient(circle at 8% 88%, rgba(255,255,255,0.07) 0 1px, transparent 2px),
      radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04), rgba(0,0,0,0.20));
    background-size: 46px 46px, 58px 58px, 52px 52px, 38px 38px, 64px 64px, 100% 100%;
  }
  #frame {
    pointer-events: none; position: absolute; inset: 0; z-index: 30;
    border: 14px solid #5c3d22;
    border-image: linear-gradient(135deg, #8a5e36, #5c3d22 45%, #7a5230 55%, #4f3219) 1;
    box-shadow: inset 0 0 40px rgba(40,22,8,0.55), inset 0 0 4px rgba(0,0,0,0.6);
  }
  #layer { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
  #strings { position: absolute; left: 0; top: 0; overflow: visible; }
  .card {
    position: absolute; width: 196px; padding: 16px 12px 11px; border-radius: 3px;
    background-color: #fbf6e7;
    background-image:
      repeating-linear-gradient(0deg, rgba(120,90,40,0.035) 0 1px, transparent 1px 22px),
      radial-gradient(circle at 78% 12%, rgba(150,120,70,0.10), transparent 40%),
      radial-gradient(circle at 12% 86%, rgba(150,120,70,0.08), transparent 38%),
      linear-gradient(150deg, #fffdf4 0%, #f6efda 100%);
    border: 1px solid rgba(120,100,60,0.28);
    box-shadow: 0 7px 14px rgba(0,0,0,0.30), 0 2px 3px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.6);
  }
  .card .title {
    font-family: 'Courier New', ui-monospace, monospace; font-weight: 700;
    font-size: 13px; line-height: 1.3; color: #1c1c1c; word-break: break-word; padding-right: 12px;
  }
  .card .rule { height: 1px; margin: 6px 0; background: rgba(192,57,43,0.42); }
  .card .body {
    font-family: 'Courier New', ui-monospace, monospace; font-size: 11px; line-height: 1.35; color: #57534e;
    margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 2px; color: #57534e; background: rgba(0,0,0,0.06); }
  .chip.pri { color: #fff; }
  .card.done .title { text-decoration: line-through; opacity: 0.65; }
  .card.armed { outline: 2px solid #e74c3c; outline-offset: 2px; }
  .colordot { position: absolute; top: 5px; left: 5px; width: 15px; height: 15px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.25); }
  .dogear { position: absolute; right: 0; bottom: 0; width: 0; height: 0; border-style: solid; border-width: 0 0 14px 14px; border-color: transparent transparent #ece2c6 transparent; filter: drop-shadow(-1px -1px 1px rgba(0,0,0,0.12)); }
  .punch { position: absolute; left: 50%; top: 3px; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: radial-gradient(circle, rgba(0,0,0,0.5), rgba(0,0,0,0.15) 60%, transparent); }
  .pin { position: absolute; left: 50%; top: -11px; transform: translateX(-50%); width: 20px; height: 22px; filter: drop-shadow(0 3px 2px rgba(0,0,0,0.45)); }
  .pin .needle { position: absolute; left: 50%; top: 12px; width: 2px; height: 10px; transform: translateX(-50%) rotate(7deg); transform-origin: top; background: linear-gradient(to bottom, #c2c5cc, #6a6d75); border-radius: 0 0 1px 1px; }
  .pin .collar { position: absolute; left: 50%; top: 10.5px; width: 7px; height: 3.5px; transform: translateX(-50%); background: linear-gradient(#e2e4e9, #888c95); border-radius: 2px; }
  .pin .head { position: absolute; left: 1px; top: 0; width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.18); }
  .pin .gloss { position: absolute; width: 5px; height: 5px; left: 5px; top: 3px; border-radius: 50%; background: rgba(255,255,255,0.8); }
  #cfab { position: absolute; left: 14px; bottom: 14px; z-index: 40; width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(0,0,0,0.55); color: #fff; font-size: 18px; display: grid; place-items: center; }
  #cpop { position: absolute; z-index: 50; display: none; width: 188px; padding: 10px; border-radius: 12px; background: #2a2a2a; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  #cpop .row { display: flex; flex-wrap: wrap; gap: 6px; }
  .sw { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); }
  .sw.auto { width: auto; padding: 0 8px; color: #ddd; font-size: 11px; background: #3a3a3a; }
  #cpop .custom { margin-top: 8px; display: flex; align-items: center; gap: 6px; color: #ccc; font-size: 11px; }
  #cpop .custom input[type=color] { width: 28px; height: 24px; border: none; background: none; padding: 0; }
  .unpin {
    position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border: none; border-radius: 50%;
    background: rgba(0,0,0,0.08); color: #57534e; font-size: 13px; line-height: 1; display: grid; place-items: center;
  }
  #labels { position: absolute; left: 0; top: 0; }
  .label {
    position: absolute; transform: translate(-50%, -50%);
    font-size: 11px; font-weight: 600; color: #292524; padding: 1px 7px; border-radius: 3px;
    background: linear-gradient(180deg, #fff8e6, #f3e6c4); border: 1px solid rgba(120,100,60,0.35);
    box-shadow: 0 1px 2px rgba(0,0,0,0.25);
  }
  .lwrap { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 4px; }
  .ldel { width: 18px; height: 18px; border: none; border-radius: 50%; background: #dc2626; color: #fff; font-size: 11px; display: grid; place-items: center; }
  .ledit { font-size: 11px; padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(120,100,60,0.5); background: #fff8e6; color: #292524; width: 110px; }
  #hint {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 40;
    background: rgba(0,0,0,0.72); color: #fff; font-size: 12px; padding: 6px 12px; border-radius: 999px; display: none;
  }
  #empty {
    position: absolute; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; padding: 32px; pointer-events: none;
  }
  #empty .box { text-align: center; max-width: 260px; background: rgba(0,0,0,0.30); color: #fff; padding: 18px 22px; border-radius: 16px; }
  #empty .box .t { font-size: 15px; font-weight: 700; }
  #empty .box .s { font-size: 13px; opacity: 0.8; margin-top: 4px; }
</style>
</head>
<body>
<div id="board">
  <div id="layer">
    <svg id="strings" width="1" height="1">
      <defs>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.35" />
        </filter>
      </defs>
    </svg>
    <div id="cards"></div>
    <div id="labels"></div>
  </div>
  <div id="frame"></div>
  <div id="hint">Tap another note to connect</div>
  <div id="empty"><div class="box"><div class="t">Nothing pinned yet</div><div class="s">Use “Pin tasks” to add notes, then drag string between them.</div></div></div>
  <button id="cfab" data-boardcolor title="Board color">🎨</button>
  <div id="cpop" data-stop>
    <div class="row" id="cpop-sw"></div>
    <div class="custom">Custom <input type="color" id="cpop-custom" value="#cc5555" /></div>
  </div>
</div>
<script>
(function () {
  var CARD_W = 196;
  var PRI = { high: '#d63a2f', medium: '#e0902a', low: '#3a7bd5', none: '#c0392b' };
  var STATUS = { todo: 'To do', 'in-progress': 'Active', done: 'Done' };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NOTE_SWATCHES = ['#d63a2f', '#e0902a', '#e7c12b', '#3a9b54', '#3a7bd5', '#8a5cd6', '#d6539e', '#5b6470'];
  var BOARD_SWATCHES = ['#c39a5c', '#7a5230', '#3f6f50', '#2f3f5c', '#7d3b3b', '#4a4a52'];

  var cards = [], connections = [], tasks = {};
  var view = { panX: 0, panY: 0, zoom: 1 };
  var connectFrom = null, connectCursor = null, selectedConn = null, editing = null;
  var drag = null;
  var pointers = {};
  var pinch = null;
  var centered = false;
  var bgColor = null;
  var colorMode = null;
  var cpopOpen = false;

  var board = document.getElementById('board');
  var layer = document.getElementById('layer');
  var svg = document.getElementById('strings');
  var cardsEl = document.getElementById('cards');
  var labelsEl = document.getElementById('labels');
  var hint = document.getElementById('hint');
  var emptyEl = document.getElementById('empty');
  var cpop = document.getElementById('cpop');
  var cpopSw = document.getElementById('cpop-sw');
  var cpopCustom = document.getElementById('cpop-custom');

  function post(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
  }
  function clampZoom(z) { return Math.max(0.4, Math.min(2, z)); }
  function cardByTask(tid) { for (var i = 0; i < cards.length; i++) if (cards[i].taskId === tid) return cards[i]; return null; }
  function cardById(id) { for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i]; return null; }
  function pinAnchor(c) { return { x: c.x + CARD_W / 2, y: c.y + 2 }; }
  function pairKey(a, b) { return a <= b ? a + '|' + b : b + '|' + a; }

  function screenToBoard(cx, cy) {
    var r = board.getBoundingClientRect();
    return { x: (cx - r.left - view.panX) / view.zoom, y: (cy - r.top - view.panY) / view.zoom };
  }
  function stringGeo(a, b) {
    var ctrlX = (a.x + b.x) / 2;
    var dist = Math.hypot(b.x - a.x, b.y - a.y);
    var sag = Math.min(56, dist * 0.16);
    var ctrlY = (a.y + b.y) / 2 + sag;
    var path = 'M ' + a.x + ' ' + a.y + ' Q ' + ctrlX + ' ' + ctrlY + ' ' + b.x + ' ' + b.y;
    var mid = { x: 0.25 * a.x + 0.5 * ctrlX + 0.25 * b.x, y: 0.25 * a.y + 0.5 * ctrlY + 0.25 * b.y };
    return { path: path, mid: mid };
  }
  function tiltFor(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return ((Math.abs(h) % 61) - 30) / 10; }
  function hexA(hex, a) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return hex;
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }
  function bodySnippet(body) {
    if (!body) return '';
    var t = body.replace(/[#*_>]/g, ' ').replace(/\\s+/g, ' ').trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }
  function fmtDate(d) { return d ? String(d).slice(5) : ''; }

  function applyView() {
    layer.style.transform = 'translate(' + view.panX + 'px,' + view.panY + 'px) scale(' + view.zoom + ')';
  }

  function autoCenter() {
    if (centered || cards.length === 0) return;
    centered = true;
    var sx = 0, sy = 0;
    for (var i = 0; i < cards.length; i++) { sx += cards[i].x + CARD_W / 2; sy += cards[i].y + 70; }
    var cx = sx / cards.length, cy = sy / cards.length;
    var r = board.getBoundingClientRect();
    view.panX = r.width / 2 - cx; view.panY = r.height / 2 - cy; view.zoom = 1;
    applyView();
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function render() {
    // Strings
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild); // keep <defs>
    for (var i = 0; i < connections.length; i++) {
      var c = connections[i];
      var a = cardByTask(c.aTaskId), b = cardByTask(c.bTaskId);
      if (!a || !b || !tasks[c.aTaskId] || !tasks[c.bTaskId]) continue;
      var g = stringGeo(pinAnchor(a), pinAnchor(b));
      var sel = selectedConn === c.id;
      var hit = document.createElementNS(SVGNS, 'path');
      hit.setAttribute('d', g.path); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '20'); hit.setAttribute('fill', 'none');
      hit.setAttribute('data-string', c.id);
      svg.appendChild(hit);
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', g.path); p.setAttribute('stroke', sel ? '#e74c3c' : '#b3382c'); p.setAttribute('stroke-width', sel ? '4' : '3');
      p.setAttribute('stroke-linecap', 'round'); p.setAttribute('fill', 'none'); p.setAttribute('filter', 'url(#sh)'); p.setAttribute('pointer-events', 'none');
      svg.appendChild(p);
    }
    if (connectFrom && connectCursor) {
      var fc = cardByTask(connectFrom);
      if (fc) {
        var lg = stringGeo(pinAnchor(fc), connectCursor);
        var lp = document.createElementNS(SVGNS, 'path');
        lp.setAttribute('d', lg.path); lp.setAttribute('stroke', '#e74c3c'); lp.setAttribute('stroke-width', '2.5');
        lp.setAttribute('stroke-dasharray', '6 6'); lp.setAttribute('stroke-linecap', 'round'); lp.setAttribute('fill', 'none'); lp.setAttribute('pointer-events', 'none');
        svg.appendChild(lp);
      }
    }

    // Labels
    labelsEl.innerHTML = '';
    for (var j = 0; j < connections.length; j++) {
      var cc = connections[j];
      var aa = cardByTask(cc.aTaskId), bb = cardByTask(cc.bTaskId);
      if (!aa || !bb || !tasks[cc.aTaskId] || !tasks[cc.bTaskId]) continue;
      var gm = stringGeo(pinAnchor(aa), pinAnchor(bb)).mid;
      var selj = selectedConn === cc.id;
      if (editing === cc.id) {
        var wrap = el('div', 'lwrap'); wrap.style.left = gm.x + 'px'; wrap.style.top = gm.y + 'px';
        var inp = el('input', 'ledit'); inp.value = cc.label || ''; inp.maxLength = 80; inp.setAttribute('data-stop', '1');
        inp.addEventListener('blur', commitEdit); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { editing = null; render(); } });
        wrap.appendChild(inp); labelsEl.appendChild(wrap);
        setTimeout(function () { inp.focus(); }, 0);
        continue;
      }
      if (!cc.label && !selj) continue;
      var lw = el('div', 'lwrap'); lw.style.left = gm.x + 'px'; lw.style.top = gm.y + 'px';
      var lbl = el('div', 'label'); lbl.textContent = cc.label || 'label…'; lbl.setAttribute('data-label', cc.id); lbl.style.transform = 'rotate(-1.5deg)';
      lw.appendChild(lbl);
      if (selj) { var del = el('button', 'ldel'); del.textContent = '✕'; del.setAttribute('data-del', cc.id); lw.appendChild(del); }
      labelsEl.appendChild(lw);
    }

    // Cards
    cardsEl.innerHTML = '';
    for (var k = 0; k < cards.length; k++) {
      var cd = cards[k];
      var t = tasks[cd.taskId];
      if (!t) continue;
      var accent = cd.color || PRI[t.priority || 'none'] || PRI.none;
      var done = t.status === 'done';
      var node = el('div', 'card' + (done ? ' done' : '') + (connectFrom === cd.taskId ? ' armed' : ''));
      node.style.left = cd.x + 'px'; node.style.top = cd.y + 'px'; node.style.transform = 'rotate(' + tiltFor(cd.id) + 'deg)';
      if (cd.color) {
        node.style.backgroundImage =
          'linear-gradient(0deg, ' + hexA(cd.color, 0.22) + ', ' + hexA(cd.color, 0.22) + '),' +
          'repeating-linear-gradient(0deg, rgba(120,90,40,0.035) 0 1px, transparent 1px 22px),' +
          'linear-gradient(150deg, #fffdf4 0%, #f6efda 100%)';
      }
      node.setAttribute('data-card-id', cd.id); node.setAttribute('data-card-task', cd.taskId);
      var chips = '<span class="chip">' + (STATUS[t.status] || t.status) + '</span>';
      if (t.priority && t.priority !== 'none') chips += '<span class="chip pri" style="background:' + accent + '">' + t.priority + '</span>';
      if (t.startDate) chips += '<span class="chip">▶ ' + esc(fmtDate(t.startDate)) + '</span>';
      if (t.dueDate) chips += '<span class="chip">⚑ ' + esc(fmtDate(t.dueDate)) + '</span>';
      var snip = bodySnippet(t.body);
      var bodyHtml = snip ? '<div class="body">' + esc(snip) + '</div>' : '';
      node.innerHTML =
        '<button class="colordot" data-colordot="' + cd.id + '" style="background:' + accent + '"></button>' +
        '<button class="unpin" data-unpin="' + cd.id + '">✕</button>' +
        '<div class="title">' + esc(t.title) + '</div><div class="rule"></div>' + bodyHtml +
        '<div class="chips">' + chips + '</div>' +
        '<div class="dogear"></div><div class="punch"></div>' +
        '<div class="pin" data-pin="' + cd.taskId + '"><div class="needle"></div><div class="collar"></div>' +
        '<div class="head" style="background:radial-gradient(circle at 32% 26%, #fff 0%, ' + accent + ' 40%, ' + accent + ' 66%, rgba(0,0,0,0.5) 100%)"></div><div class="gloss"></div></div>';
      cardsEl.appendChild(node);
    }

    hint.style.display = connectFrom ? 'block' : 'none';
    emptyEl.style.display = cards.length === 0 ? 'flex' : 'none';
    applyView();
  }

  function commitEdit() {
    if (editing == null) return;
    var inp = labelsEl.querySelector('.ledit');
    var val = inp ? inp.value : '';
    post({ type: 'relabel', connId: editing, label: val });
    var c = null; for (var i = 0; i < connections.length; i++) if (connections[i].id === editing) c = connections[i];
    if (c) c.label = val.trim().slice(0, 80);
    editing = null; render();
  }

  // --- pointer interaction ---
  function onDown(e) {
    var target = e.target;
    if (target.closest && target.closest('[data-stop]')) return;
    if (cpopOpen) closePopover();
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);

    if (ids.length === 2) {
      var p0 = pointers[ids[0]], p1 = pointers[ids[1]];
      var r = board.getBoundingClientRect();
      pinch = { dist: Math.hypot(p0.x - p1.x, p0.y - p1.y), cx: (p0.x + p1.x) / 2 - r.left, cy: (p0.y + p1.y) / 2 - r.top, vp: { panX: view.panX, panY: view.panY, zoom: view.zoom } };
      drag = null;
      return;
    }
    if (ids.length > 2) return;

    var bcEl = target.closest && target.closest('[data-boardcolor]');
    if (bcEl) { var br = bcEl.getBoundingClientRect(); openPopover('board', null, br.left, br.bottom); return; }
    var cdotEl = target.closest && target.closest('[data-colordot]');
    if (cdotEl) { var cr = cdotEl.getBoundingClientRect(); openPopover('card', cdotEl.getAttribute('data-colordot'), cr.left, cr.bottom); return; }

    // Discrete taps handled on up; record element.
    var delEl = target.closest && target.closest('[data-del]');
    if (delEl) { post({ type: 'disconnect', connId: delEl.getAttribute('data-del') }); connections = connections.filter(function (c) { return c.id !== delEl.getAttribute('data-del'); }); selectedConn = null; render(); return; }
    var unpinEl = target.closest && target.closest('[data-unpin]');
    if (unpinEl) { var cid = unpinEl.getAttribute('data-unpin'); var cobj = cardById(cid); post({ type: 'unpin', cardId: cid }); if (cobj) { connections = connections.filter(function (c) { return c.aTaskId !== cobj.taskId && c.bTaskId !== cobj.taskId; }); } cards = cards.filter(function (c) { return c.id !== cid; }); render(); return; }
    var labelEl = target.closest && target.closest('[data-label]');
    if (labelEl) { editing = labelEl.getAttribute('data-label'); render(); return; }
    var stringEl = target.closest && target.closest('[data-string]');
    if (stringEl) { var sid = stringEl.getAttribute('data-string'); selectedConn = selectedConn === sid ? null : sid; render(); return; }

    var cardEl = target.closest && target.closest('[data-card-id]');

    if (connectFrom) {
      if (cardEl) { var tt = cardEl.getAttribute('data-card-task'); if (tt !== connectFrom) { addConnection(connectFrom, tt); post({ type: 'connect', fromTaskId: connectFrom, toTaskId: tt }); } }
      connectFrom = null; connectCursor = null; render(); return;
    }

    selectedConn = null;
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    var bp = screenToBoard(e.clientX, e.clientY);
    if (cardEl) {
      var cardId = cardEl.getAttribute('data-card-id');
      var taskId = cardEl.getAttribute('data-card-task');
      if (target.closest('[data-pin]')) {
        drag = { kind: 'connect', fromTaskId: taskId, downX: e.clientX, downY: e.clientY, moved: false };
        connectFrom = taskId; connectCursor = bp; render();
      } else {
        var card = cardById(cardId);
        if (!card) return;
        drag = { kind: 'card', cardId: cardId, grabDX: bp.x - card.x, grabDY: bp.y - card.y, downX: e.clientX, downY: e.clientY, moved: false };
      }
    } else {
      drag = { kind: 'pan', downX: e.clientX, downY: e.clientY, panX0: view.panX, panY0: view.panY };
    }
  }

  function onMove(e) {
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch && Object.keys(pointers).length >= 2) {
      var ids = Object.keys(pointers); var p0 = pointers[ids[0]], p1 = pointers[ids[1]];
      var dist = Math.hypot(p0.x - p1.x, p0.y - p1.y);
      var zoom = clampZoom(pinch.vp.zoom * (dist / pinch.dist));
      var scale = zoom / pinch.vp.zoom;
      view.zoom = zoom;
      view.panX = pinch.cx - (pinch.cx - pinch.vp.panX) * scale;
      view.panY = pinch.cy - (pinch.cy - pinch.vp.panY) * scale;
      applyView();
      return;
    }
    if (!drag) return;
    var moved = Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 5;
    if (drag.kind === 'pan') {
      view.panX = drag.panX0 + (e.clientX - drag.downX); view.panY = drag.panY0 + (e.clientY - drag.downY); applyView(); return;
    }
    var bp = screenToBoard(e.clientX, e.clientY);
    if (drag.kind === 'card') {
      if (moved) drag.moved = true;
      var card = cardById(drag.cardId);
      if (card) { card.x = bp.x - drag.grabDX; card.y = bp.y - drag.grabDY; render(); }
    } else if (drag.kind === 'connect') {
      if (moved) drag.moved = true;
      connectCursor = bp; render();
    }
  }

  function onUp(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    try { board.releasePointerCapture(e.pointerId); } catch (err) {}
    var d = drag; drag = null;
    if (!d) return;
    if (d.kind === 'card') {
      var card = cardById(d.cardId);
      if (!card) return;
      if (d.moved) post({ type: 'move', cardId: d.cardId, x: card.x, y: card.y });
      else post({ type: 'open', taskId: card.taskId });
    } else if (d.kind === 'connect') {
      if (d.moved) {
        var over = document.elementFromPoint(e.clientX, e.clientY);
        var oc = over && over.closest ? over.closest('[data-card-id]') : null;
        var tt = oc ? oc.getAttribute('data-card-task') : null;
        if (tt && tt !== d.fromTaskId) { addConnection(d.fromTaskId, tt); post({ type: 'connect', fromTaskId: d.fromTaskId, toTaskId: tt }); }
        connectFrom = null; connectCursor = null; render();
      } else {
        connectFrom = d.fromTaskId; connectCursor = null; render();
      }
    }
  }

  function addConnection(from, to) {
    var key = pairKey(from, to);
    for (var i = 0; i < connections.length; i++) if (pairKey(connections[i].aTaskId, connections[i].bTaskId) === key) return;
    var a = from <= to ? from : to, b = from <= to ? to : from;
    connections.push({ id: 'tmp-' + key, aTaskId: a, bTaskId: b, label: '' });
  }

  // --- color picker popover ---
  function openPopover(kind, cardId, ax, ay) {
    colorMode = { kind: kind, cardId: cardId };
    var sws = kind === 'board' ? BOARD_SWATCHES : NOTE_SWATCHES;
    var html = '';
    if (kind === 'card') html += '<button class="sw auto" data-auto>Auto</button>';
    for (var i = 0; i < sws.length; i++) html += '<button class="sw" data-sw="' + sws[i] + '" style="background:' + sws[i] + '"></button>';
    cpopSw.innerHTML = html;
    var px = Math.max(8, Math.min(ax - 20, window.innerWidth - 196));
    var py = ay + 8;
    if (py + 130 > window.innerHeight) py = Math.max(8, ay - 140);
    cpop.style.left = px + 'px'; cpop.style.top = py + 'px'; cpop.style.display = 'block';
    cpopOpen = true;
  }
  function closePopover() { cpop.style.display = 'none'; cpopOpen = false; colorMode = null; }
  function applyColor(hex) {
    if (!colorMode) return;
    if (colorMode.kind === 'board') {
      bgColor = hex || null; board.style.backgroundColor = hex || '#c39a5c';
      post({ type: 'boardColor', color: hex });
    } else {
      var c = cardById(colorMode.cardId);
      if (c) c.color = hex || null;
      post({ type: 'recolor', cardId: colorMode.cardId, color: hex });
    }
    closePopover();
    render();
  }
  cpopSw.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-auto')) { applyColor(''); return; }
    var sw = t.getAttribute('data-sw');
    if (sw) applyColor(sw);
  });
  cpopCustom.addEventListener('change', function () { applyColor(cpopCustom.value); });

  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);

  // --- API from React Native ---
  window.__setBoard = function (data) {
    cards = data.cards || [];
    connections = data.connections || [];
    tasks = data.tasks || {};
    bgColor = data.bgColor || null;
    board.style.backgroundColor = bgColor || '#c39a5c';
    if (cpopOpen) closePopover();
    autoCenter();
    render();
  };
  window.__zoom = function (factor) {
    var r = board.getBoundingClientRect();
    var cx = r.width / 2, cy = r.height / 2;
    var zoom = clampZoom(view.zoom * factor);
    var scale = zoom / view.zoom;
    view.zoom = zoom; view.panX = cx - (cx - view.panX) * scale; view.panY = cy - (cy - view.panY) * scale; applyView();
  };
  window.__reset = function () { centered = false; autoCenter(); };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
