/* Dashboard simulata, foresta e mappa delle realizzazioni. Script classico, nessuna dipendenza. */
(function () {
  const $ = s => document.querySelector(s);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmtN = n => n.toLocaleString('it-IT');

  /* ---------- foresta: cresce quando la sezione entra in vista ---------- */
  const sust = $('#sostenibilita');
  if (sust) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { sust.classList.add('go'); o.disconnect(); } }), { threshold: .2 }).observe(sust);

  /* ---------- dashboard dimostrativa ---------- */
  const tilesEl = $('#tiles');
  if (tilesEl) {
    const defs = [
      { id: 'wind', name: 'Vento', unit: 'm/s', base: 7, amp: 2.2, thr: 20, dec: 1 },
      { id: 'rain', name: 'Acqua in copertura', unit: 'L/s', base: 2, amp: .6, thr: 9, dec: 1 },
      { id: 'temp', name: 'Temperatura interna', unit: '°C', base: 19.5, amp: .35, thr: 32, dec: 1 },
      { id: 'co2', name: 'CO₂ interna', unit: 'ppm', base: 620, amp: 40, thr: 1000, dec: 0 },
    ];
    const N = 70;
    const T = defs.map(d => {
      const el = document.createElement('div'); el.className = 'tile';
      el.innerHTML = `<div class="tn">${d.name}</div><div class="tv"><span>—</span><small>${d.unit}</small></div><canvas width="260" height="46"></canvas>`;
      tilesEl.appendChild(el);
      return { ...d, el, v: d.base, hist: new Array(N).fill(d.base), push: 0, cv: el.querySelector('canvas'), val: el.querySelector('.tv span') };
    });
    const log = $('#dLog'); let logT = 0;
    const say = (txt, cls) => { log.textContent = txt; log.className = 'dlog ' + (cls || ''); clearTimeout(logT); if (cls) logT = setTimeout(() => { log.textContent = 'Tutti i parametri nella norma.'; log.className = 'dlog ok'; T.forEach(t => { t.push = 0; }); }, 9000); };
    const byId = id => T.find(t => t.id === id);
    $('#dWind').addEventListener('click', () => { byId('wind').push = 1; say('Raffica sopra la soglia di progetto: alert inviato all’app e al referente dell’immobile.', 'bad'); });
    $('#dRain').addEventListener('click', () => { byId('rain').push = 1; say('Pluviale ostruito: il livello sale, avviso al Centro di Controllo.', 'bad'); });
    $('#dReset').addEventListener('click', () => { T.forEach(t => { t.push = 0; }); say('Tutti i parametri nella norma.', 'ok'); });
    let last = performance.now(), acc = 0, visible = false;
    new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; }), { threshold: .1 }).observe(tilesEl);
    function draw(t) {
      const c = t.cv, g = c.getContext('2d'), w = c.width, h = c.height;
      const lo = t.base - t.amp * 3, hi = Math.max(t.thr * 1.1, t.base + t.amp * 3), y = v => h - 4 - (v - lo) / (hi - lo) * (h - 8);
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y(t.thr)); g.lineTo(w, y(t.thr)); g.stroke(); g.setLineDash([]);
      const over = t.v > t.thr;
      g.strokeStyle = over ? '#ff6a6a' : '#6db4ff'; g.lineWidth = 2; g.beginPath();
      t.hist.forEach((v, i) => { const x = i / (N - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); }); g.stroke();
    }
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!visible) return;
      acc += dt; if (acc < .12) return; acc = 0;
      T.forEach(t => {
        const target = t.push ? t.thr * 1.35 : t.base;
        t.v += (target - t.v) * (t.push ? .22 : .12) + (Math.random() - .5) * t.amp * .5;
        t.hist.push(t.v); t.hist.shift();
        t.val.textContent = t.v.toLocaleString('it-IT', { minimumFractionDigits: t.dec, maximumFractionDigits: t.dec });
        t.el.classList.toggle('alert', t.v > t.thr);
        draw(t);
      });
    }
    requestAnimationFrame(tick);
  }

  /* ---------- mappa delle realizzazioni ---------- */
  const svg = $('#itmap');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  Promise.all([fetch('data/italy.json').then(r => r.json()), fetch('data/projects.json').then(r => r.json())]).then(([IT, P]) => {
    const proj = (lat, lon) => [(lon - IT.lon0) * IT.cx * IT.k, (IT.lat0 - lat) * IT.k];
    const norm = s => (s || '').replace('Emilia Romagna', 'Emilia-Romagna');
    const has = new Set(P.map(p => norm(p.r)).filter(Boolean));
    const gReg = mk('g', {}, svg), gLab = mk('g', {}, svg), gPins = mk('g', {}, svg), gAgg = mk('g', {}, svg);
    IT.regions.forEach(r => { const p = mk('path', { d: r.d, class: 'reg' + (has.has(r.name) ? ' has' : '') }, gReg); p.dataset.n = r.name;
      if (has.has(r.name)) { const t = mk('text', { x: r.cx, y: r.cy, class: 'rlab' }, gLab); t.textContent = r.name.replace('Emilia-Romagna', 'Emilia R.'); } });

    // pin posizionati, con piccolo scostamento se due progetti cadono nello stesso punto
    const groups = {};
    P.forEach((p, i) => { if (p.ll) { const key = p.ll.map(x => x.toFixed(3)).join(','); (groups[key] = groups[key] || []).push(i); } });
    const pins = [];
    Object.values(groups).forEach(list => list.forEach((i, j) => {
      const p = P[i], [x0, y0] = proj(p.ll[0], p.ll[1]);
      const a = j / list.length * Math.PI * 2, off = list.length > 1 ? 3.2 : 0;
      const x = x0 + Math.cos(a) * off, y = y0 + Math.sin(a) * off;
      const g = mk('g', { class: 'pin ' + p.k }, gPins); g.style.setProperty('--i', pins.length);
      mk('circle', { class: 'halo', cx: x, cy: y, r: 3.4 }, g); mk('circle', { class: 'd', cx: x, cy: y, r: 3.4 }, g);
      g._p = p; g._xy = [x, y]; pins.push(g);
    }));
    // riqualificazioni/nuove senza città: cerchio per regione con il conteggio
    const regC = Object.fromEntries(IT.regions.map(r => [r.name, r]));
    const aggs = [];
    const byReg = {};
    P.forEach(p => { if (!p.ll && p.r) { const key = p.k + '|' + norm(p.r); (byReg[key] = byReg[key] || []).push(p); } });
    Object.entries(byReg).forEach(([key, list]) => {
      const [k, reg] = key.split('|'), r = regC[reg]; if (!r) return;
      const g = mk('g', { class: 'agg ' + k }, gAgg), x = r.cx + (k === 'r' ? 16 : -16), y = r.cy + 14;
      mk('circle', { cx: x, cy: y, r: 8.5 }, g); const t = mk('text', { x, y }, g); t.textContent = list.length;
      g._list = list; g._k = k; g._reg = reg; g._xy = [x, y]; aggs.push(g);
    });

    /* stato e filtri */
    const on = { n: true, r: true }; let sector = '';
    const vis = p => on[p.k] && (!sector || p.c === sector);
    const counts = () => { const c = { n: 0, r: 0 }; P.forEach(p => { if (vis(p)) c[p.k]++; }); return c; };
    const total = { n: P.filter(p => p.k === 'n').length, r: P.filter(p => p.k === 'r').length };
    const sectors = [...new Set(P.map(p => p.c).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    const sel = $('#sector'); sel.innerHTML = '<option value="">Tutti i settori</option>' + sectors.map(s => `<option>${s}</option>`).join('');
    function refresh() {
      pins.forEach(g => g.classList.toggle('hide', !vis(g._p)));
      aggs.forEach(g => g.classList.toggle('hide', !on[g._k] || !!sector));
      const c = counts(); $('#cN').textContent = fmtN(c.n); $('#cR').textContent = fmtN(c.r);
      document.querySelectorAll('#legend button').forEach(b => b.classList.toggle('off', !on[b.dataset.k]));
      // barre per regione
      const rc = {}; P.forEach(p => { if (vis(p) && p.r) { const r = norm(p.r); rc[r] = rc[r] || { n: 0, r: 0 }; rc[r][p.k]++; } });
      const rows = Object.entries(rc).sort((a, b) => (b[1].n + b[1].r) - (a[1].n + a[1].r)), mx = Math.max(1, ...rows.map(r => r[1].n + r[1].r));
      $('#rbars').innerHTML = rows.slice(0, 8).map(([n, v]) => `<div class="rb"><span>${n}</span><div class="bar2"><i class="n" style="width:${v.n / mx * 100}%"></i><i class="r" style="width:${v.r / mx * 100}%"></i></div><em>${v.n + v.r}</em></div>`).join('') || '<div class="meta" style="color:var(--dim)">Nessun progetto con questi filtri.</div>';
    }
    document.querySelectorAll('#legend button').forEach(b => b.addEventListener('click', () => { on[b.dataset.k] = !on[b.dataset.k]; refresh(); }));
    sel.addEventListener('change', () => { sector = sel.value; refresh(); });
    const placed = P.filter(p => p.ll).length, nocity = P.length - placed;
    $('#mnote').textContent = `${fmtN(total.n)} nuove realizzazioni e ${fmtN(total.r)} riqualificazioni pubblicate su manini.it. ${fmtN(placed)} hanno una località precisa. Per ${fmtN(nocity)} il sito indica solo la regione (cerchi tratteggiati) o nulla.`;
    refresh();

    /* tooltip + scheda di dettaglio */
    const box = $('#mapbox'), tip = $('#mtip'), card = $('#sel');
    const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const info = p => `<span class="bd ${p.k}">${p.k === 'n' ? 'Nuova realizzazione' : 'Riqualificazione'}</span><h4>${esc(p.t)}</h4><div class="meta">${esc(p.l || '')}${p.l && p.r ? ' · ' : ''}${esc(norm(p.r))}${p.s ? '<br>Sistema: ' + esc(p.s) : ''}${p.c ? '<br>Settore: ' + esc(p.c) : ''}</div><a href="${p.u}" target="_blank" rel="noopener">Apri la scheda su manini.it ›</a>`;
    const showTip = (html, ev) => { const r = box.getBoundingClientRect(); tip.innerHTML = html; let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14; if (x > r.width - 270) x = ev.clientX - r.left - 270; if (y > r.height - 110) y = ev.clientY - r.top - 110; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px'; tip.classList.add('on'); };
    let selected = null;
    pins.forEach(g => {
      g.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') showTip(`<b>${esc(g._p.t)}</b><i>${esc(g._p.l)}</i>`, ev); });
      g.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') showTip(`<b>${esc(g._p.t)}</b><i>${esc(g._p.l)}</i>`, ev); });
      g.addEventListener('pointerleave', () => tip.classList.remove('on'));
      g.addEventListener('click', e => { e.stopPropagation(); if (moved) return; if (selected) selected.classList.remove('sel'); selected = g; g.classList.add('sel'); card.innerHTML = '<div class="eyebrow">Dettaglio</div>' + info(g._p); tip.classList.remove('on'); });
    });
    aggs.forEach(g => {
      const html = `<b>${g._list.length} ${g._k === 'r' ? 'riqualificazioni' : 'realizzazioni'} in ${esc(g._reg)}</b><i>Località non indicata sul sito</i>`;
      g.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') showTip(html, ev); });
      g.addEventListener('pointerleave', () => tip.classList.remove('on'));
      g.addEventListener('click', e => { e.stopPropagation(); if (moved) return; card.innerHTML = `<div class="eyebrow">Dettaglio</div><span class="bd ${g._k}">${g._k === 'r' ? 'Riqualificazioni' : 'Nuove'}</span><h4>${g._list.length} in ${esc(g._reg)}</h4><div class="meta">${g._list.map(p => `<a href="${p.u}" target="_blank" rel="noopener" style="display:block;margin:0 0 6px;font-weight:400">${esc(p.t)}</a>`).join('')}</div>`; });
    });
    svg.addEventListener('click', () => { if (selected) selected.classList.remove('sel'); selected = null; });

    /* zoom e pan */
    const VB0 = { x: -6, y: 0, w: 610, h: 786 }; let vb = { ...VB0 }, z = 1, moved = false;
    const apply = () => {
      svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
      z = VB0.w / vb.w; const r = 3.4 / Math.pow(z, .72);
      pins.forEach(g => g.querySelectorAll('circle').forEach(c => c.setAttribute('r', r)));
      aggs.forEach(g => { g.querySelector('circle').setAttribute('r', 8.5 / Math.pow(z, .6)); g.querySelector('text').style.fontSize = 7.5 / Math.pow(z, .6) + 'px'; });
      gLab.style.opacity = z > 2.2 ? 0 : 1;
    };
    const zoomAt = (f, cx, cy) => { // cx, cy in coordinate SVG
      const nw = clamp(vb.w / f, VB0.w / 9, VB0.w), nh = nw * VB0.h / VB0.w;
      vb = { x: cx - (cx - vb.x) * nw / vb.w, y: cy - (cy - vb.y) * nh / vb.h, w: nw, h: nh };
      vb.x = clamp(vb.x, VB0.x - 20, VB0.x + VB0.w - vb.w + 20); vb.y = clamp(vb.y, -20, VB0.h - vb.h + 20); apply();
    };
    const toSvg = (px, py) => { const r = box.getBoundingClientRect(); return [vb.x + (px - r.left) / r.width * vb.w, vb.y + (py - r.top) / r.height * vb.h]; };
    $('#mzi').addEventListener('click', () => zoomAt(1.6, vb.x + vb.w / 2, vb.y + vb.h / 2));
    $('#mzo').addEventListener('click', () => zoomAt(1 / 1.6, vb.x + vb.w / 2, vb.y + vb.h / 2));
    $('#mz0').addEventListener('click', () => { vb = { ...VB0 }; apply(); });
    box.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const [cx, cy] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.25 : .8, cx, cy); }, { passive: false });
    box.addEventListener('dblclick', e => { const [cx, cy] = toSvg(e.clientX, e.clientY); zoomAt(1.8, cx, cy); });
    const ptrs = new Map(); let pinch = 0, sx = 0, sy = 0;
    box.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false; sx = e.clientX; sy = e.clientY; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    box.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) { const [cx, cy] = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(d / pinch, cx, cy); } pinch = d; moved = true; return; }
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 5) moved = true;
      if (!moved || z <= 1.001) return;
      const r = box.getBoundingClientRect();
      vb.x = clamp(vb.x - (e.clientX - prev[0]) / r.width * vb.w, VB0.x - 20, VB0.x + VB0.w - vb.w + 20);
      vb.y = clamp(vb.y - (e.clientY - prev[1]) / r.height * vb.h, -20, VB0.h - vb.h + 20); apply();
    });
    const end = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; setTimeout(() => { moved = false; }, 0); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end); box.addEventListener('pointerleave', end);
    // su mobile: un dito scorre la pagina quando non si è zoomati
    new ResizeObserver(() => { box.style.touchAction = z > 1.001 ? 'none' : 'pan-y'; }).observe(box);
    const syncTouch = () => { box.style.touchAction = z > 1.001 ? 'none' : 'pan-y'; }; box.addEventListener('click', syncTouch); $('#mzi').addEventListener('click', syncTouch); $('#mz0').addEventListener('click', syncTouch);
    box.style.touchAction = 'pan-y';

    // animazione dei pin all'ingresso in vista
    new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { pins.forEach(g => g.classList.add('pop')); o.disconnect(); } }), { threshold: .25 }).observe(box);
    setTimeout(() => pins.forEach(g => g.classList.add('pop')), 5000);
    apply();
  }).catch(err => { const n = document.getElementById('mnote'); if (n) n.textContent = 'Impossibile caricare i dati della mappa.'; console.error(err); });
})();
