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
      radial-gradient(circle at 18% 22%, rgba(80,50,20,0.16) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 62% 44%, rgba(70,45,18,0.13) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 38% 78%, rgba(255,240,210,0.10) 0 1.5px, transparent 2.5px),
      radial-gradient(circle at 82% 64%, rgba(60,38,14,0.12) 0 1px, transparent 2px),
      radial-gradient(circle at 8% 88%, rgba(255,240,210,0.08) 0 1px, transparent 2px),
      radial-gradient(circle at 50% 50%, rgba(150,110,60,0.22), rgba(120,84,40,0.34));
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
    position: absolute; width: 196px; padding: 14px 12px 10px; border-radius: 3px;
    background: linear-gradient(150deg, #fffdf4 0%, #f7f0dd 100%);
    border: 1px solid rgba(120,100,60,0.25);
    box-shadow: 0 6px 12px rgba(0,0,0,0.32), 0 1px 2px rgba(0,0,0,0.25);
  }
  .card .title {
    font-family: 'Courier New', ui-monospace, monospace; font-weight: 700;
    font-size: 13px; line-height: 1.3; color: #1c1c1c; word-break: break-word;
  }
  .card .rule { height: 1px; margin: 6px 0; background: rgba(192,57,43,0.45); }
  .card .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 2px; color: #57534e; background: rgba(0,0,0,0.06); }
  .chip.pri { color: #fff; }
  .card.done .title { text-decoration: line-through; opacity: 0.65; }
  .card.armed { outline: 2px solid #e74c3c; outline-offset: 2px; }
  .pin { position: absolute; left: 50%; top: -9px; transform: translateX(-50%); width: 18px; height: 18px; filter: drop-shadow(0 2px 1.5px rgba(0,0,0,0.4)); }
  .pin .head { position: absolute; inset: 0; border-radius: 50%; }
  .pin .gloss { position: absolute; width: 5px; height: 5px; left: 4px; top: 3px; border-radius: 50%; background: rgba(255,255,255,0.7); }
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
</div>
<script>
(function () {
  var CARD_W = 196;
  var PRI = { high: '#d63a2f', medium: '#e0902a', low: '#3a7bd5', none: '#c0392b' };
  var STATUS = { todo: 'To do', 'in-progress': 'Active', done: 'Done' };
  var SVGNS = 'http://www.w3.org/2000/svg';

  var cards = [], connections = [], tasks = {};
  var view = { panX: 0, panY: 0, zoom: 1 };
  var connectFrom = null, connectCursor = null, selectedConn = null, editing = null;
  var drag = null;
  var pointers = {};
  var pinch = null;
  var centered = false;

  var board = document.getElementById('board');
  var layer = document.getElementById('layer');
  var svg = document.getElementById('strings');
  var cardsEl = document.getElementById('cards');
  var labelsEl = document.getElementById('labels');
  var hint = document.getElementById('hint');
  var emptyEl = document.getElementById('empty');

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
      var color = PRI[t.priority || 'none'] || PRI.none;
      var done = t.status === 'done';
      var node = el('div', 'card' + (done ? ' done' : '') + (connectFrom === cd.taskId ? ' armed' : ''));
      node.style.left = cd.x + 'px'; node.style.top = cd.y + 'px'; node.style.transform = 'rotate(' + tiltFor(cd.id) + 'deg)';
      node.setAttribute('data-card-id', cd.id); node.setAttribute('data-card-task', cd.taskId);
      var chips = '<span class="chip">' + (STATUS[t.status] || t.status) + '</span>';
      if (t.priority && t.priority !== 'none') chips += '<span class="chip pri" style="background:' + color + '">' + t.priority + '</span>';
      if (t.dueDate) chips += '<span class="chip">' + esc(String(t.dueDate).slice(5)) + '</span>';
      node.innerHTML =
        '<div class="pin" data-pin="' + cd.taskId + '"><div class="head" style="background:radial-gradient(circle at 32% 28%, #fff 0%, ' + color + ' 42%, ' + color + ' 70%, rgba(0,0,0,0.45) 100%)"></div><div class="gloss"></div></div>' +
        '<button class="unpin" data-unpin="' + cd.id + '">✕</button>' +
        '<div class="title">' + esc(t.title) + '</div><div class="rule"></div><div class="chips">' + chips + '</div>';
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

  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);

  // --- API from React Native ---
  window.__setBoard = function (data) {
    cards = data.cards || [];
    connections = data.connections || [];
    tasks = data.tasks || {};
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
