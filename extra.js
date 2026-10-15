/* Dashboard simulata, foresta e mappa delle realizzazioni. Script classico, nessuna dipendenza. */
(function () {
  const $ = s => document.querySelector(s);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmtN = n => n.toLocaleString('it-IT');

  /* ---------- menu hamburger (mobile) ---------- */
  const burger = $('#burger'), menu = $('#menu');
  if (burger && menu) {
    const setMenu = open => {
      menu.classList.toggle('open', open); burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open); menu.setAttribute('aria-hidden', !open);
      burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    const jump = (el, block) => { setMenu(false); setTimeout(() => el && el.scrollIntoView({ behavior: 'smooth', block }), 60); };
    menu.addEventListener('click', e => {
      const a = e.target.closest('a'); if (!a) return; e.preventDefault();
      if (a.dataset.b) return jump(document.querySelector(`[data-beat="${a.dataset.b}"]`), 'center');
      const id = a.getAttribute('href'); jump(id === '#top' ? document.body : document.querySelector(id), 'start');
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    addEventListener('resize', () => { if (innerWidth > 900) setMenu(false); });
  }

  /* ---------- modulo di contatto ---------- */
  // Invio: servizio FormSubmit (gratuito, senza backend). La prima richiesta reale genera una mail di attivazione al destinatario.
  const FORM_TO = 'com@manini.it';
  const FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_TO;
  const cform = $('#cform');
  if (cform) {
    const steps = [...cform.querySelectorAll('.cf-step')], dots = [...cform.querySelectorAll('.cf-prog span')];
    const next = $('#cfNext'), back = $('#cfBack'), send = $('#cfSend'), err = $('#cfErr'), bar = $('#cfBar');
    let cur = 1;
    const val = n => (cform.elements[n] && cform.elements[n].value || '').trim();
    const checked = n => (cform.querySelector(`input[name="${n}"]:checked`) || {}).value || '';
    const show = n => {
      cur = n; steps.forEach(s => s.classList.toggle('on', +s.dataset.s === n));
      dots.forEach((d, i) => d.classList.toggle('on', i < n)); bar.style.width = `calc((100% - 28px) * ${(n - 1) / 2})`;
      back.hidden = n === 1; next.hidden = n === 3; send.hidden = n !== 3; err.textContent = '';
      if (n === 3) $('#cfRecap').textContent = [checked('intervention').replace('Rifacimento/Sostituzione copertura industriale e Efficientamento Energetico', 'Copertura ed efficientamento').replace('Manutenzione Ordinaria e/o Straordinaria', 'Manutenzione'), ({ '<1000 mq': 'meno di 1.000 m²', '1000<3000 mq': '1.000–3.000 m²', '>3000 mq': 'oltre 3.000 m²' })[checked('build-mq')], val('town')].filter(Boolean).join(' · ');
    };
    const bad = (el, msg) => { err.textContent = msg; const f = el.closest('.fld,.quals,.chk'); if (f) { f.classList.add('bad'); setTimeout(() => f.classList.remove('bad'), 2500); } el.focus && el.focus({ preventScroll: false }); return false; };
    const okMail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const validate = n => {
      if (n === 1) { if (!checked('intervention')) { err.textContent = 'Scegli il tipo di intervento.'; return false; } }
      if (n === 2) {
        if (!checked('build-mq')) { err.textContent = 'Indica la dimensione approssimativa.'; return false; }
        if (!val('use')) return bad(cform.elements.use, 'Scrivi la destinazione d’uso.');
        if (!val('town')) return bad(cform.elements.town, 'Scrivi città e provincia.');
      }
      if (n === 3) {
        if (!checked('qualification')) { const q = cform.querySelector('.quals'); q.classList.add('bad'); setTimeout(() => q.classList.remove('bad'), 2500); err.textContent = 'Scegli la tua qualifica.'; return false; }
        if (!val('your-name')) return bad(cform.elements['your-name'], 'Scrivi nome e cognome.');
        if (!val('your-company')) return bad(cform.elements['your-company'], 'Scrivi il nome dell’azienda.');
        if (!okMail(val('email'))) return bad(cform.elements.email, 'Controlla l’indirizzo email.');
        if (val('tel').replace(/\D/g, '').length < 6) return bad(cform.elements.tel, 'Scrivi un numero di telefono.');
        if (!val('your-area')) return bad(cform.elements['your-area'], 'Scrivi il settore produttivo.');
        if (!cform.elements.privacy.checked) return bad(cform.elements.privacy, 'Serve il consenso al trattamento dei dati.');
      }
      return true;
    };
    next.addEventListener('click', () => { if (validate(cur)) show(cur + 1); });
    back.addEventListener('click', () => show(cur - 1));
    cform.querySelectorAll('.opt input').forEach(i => i.addEventListener('change', () => setTimeout(() => { if (cur === 1) show(2); }, 280)));
    $('#usechips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cform.elements.use.value = b.textContent; cform.elements.use.dispatchEvent(new Event('input')); });
    cform.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); cur < 3 ? next.click() : send.click(); } });
    const payload = () => {
      const d = {
        'Tipo di intervento': checked('intervention'), 'Area mq': checked('build-mq'), 'Destinazione d\'uso': val('use'), 'Città, provincia della realizzazione': val('town'),
        'Qualifica': checked('qualification'), 'Nome e cognome': val('your-name'), 'Azienda': val('your-company'), 'Settore produttivo': val('your-area'), 'Email': val('email'), 'Telefono': val('tel'),
        'Note aggiuntive': val('your-message'), 'Consenso privacy': 'sì', 'Richiesta di essere contattato': cform.elements.callback.checked ? 'sì' : 'no', 'Origine': 'Landing page 3D ' + location.href,
      };
      return { ...d, email: d['Email'], name: d['Nome e cognome'], _subject: 'Nuova richiesta dalla landing: ' + d['Tipo di intervento'], _template: 'table', _captcha: 'false', _honey: val('_honey') };
    };
    const mailto = p => 'mailto:' + FORM_TO + '?subject=' + encodeURIComponent(p._subject) + '&body=' + encodeURIComponent(Object.entries(p).filter(([k]) => !k.startsWith('_') && !['email', 'name'].includes(k)).map(([k, v]) => `${k}: ${v}`).join('\n'));
    cform.addEventListener('submit', async e => {
      e.preventDefault(); if (!validate(3)) return;
      const p = payload(); if (p._honey) return;
      send.classList.add('sending'); send.textContent = 'Invio in corso…'; err.textContent = '';
      try {
        const r = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(p) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || (j.success !== true && j.success !== 'true')) throw new Error(j.message || 'errore ' + r.status);
        cform.hidden = true; const ok = $('#cfOk'); ok.hidden = false; ok.focus({ preventScroll: true });
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (x) {
        err.innerHTML = 'Non sono riuscito a inviare la richiesta. <a href="' + mailto(p) + '" style="color:var(--accent);text-decoration:underline">Invia con la tua email</a> oppure scrivi a ' + FORM_TO + '.';
      } finally { send.classList.remove('sending'); send.textContent = 'Invia la richiesta'; }
    });
    $('#cfAgain').addEventListener('click', () => { cform.reset(); cform.hidden = false; $('#cfOk').hidden = true; show(1); });
    // precompilazione da altre sezioni (Manini Service, configuratore)
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-prefill]'); if (!t) return;
      e.preventDefault();
      const r = [...cform.querySelectorAll('input[name="intervention"]')].find(i => i.value === t.dataset.prefill); if (r) r.checked = true;
      let note = t.dataset.note || ''; if (t.dataset.cfg && window.__cfgText) note = window.__cfgText();
      if (note) { cform.elements['your-message'].value = note; cform.elements['your-message'].dispatchEvent(new Event('input')); }
      cform.hidden = false; $('#cfOk').hidden = true; show(r ? 2 : 1);
      $('#contatti').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    show(1);
  }

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
  const SV = d => `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    'Produzione': SV('<path d="M3 20V10l5 3v-3l5 3V6h4v14z"/><path d="M3 20h14"/>'),
    'Industria': SV('<path d="M3 18h18"/><path d="M5 18a7 7 0 0114 0"/><path d="M12 6v6.5M8.5 18v-4.5"/>'),
    'Centro Commerciale': SV('<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'),
    'Food & Beverage': SV('<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>'),
    'Moda': SV('<path d="M12 7a2 2 0 10-2-2"/><path d="M12 7v2L3 16a1 1 0 00.6 1.8h16.8A1 1 0 0021 16l-9-7"/>'),
    'Automotive': SV('<path d="M4 15l1.6-5A2 2 0 017.5 8.5h9a2 2 0 011.9 1.5L20 15"/><path d="M3 15h18v3H3z"/><circle cx="7.5" cy="18.2" r="1.2"/><circle cx="16.5" cy="18.2" r="1.2"/>'),
    'Arredamento & Immobiliare': SV('<path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M3 12a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3z"/><path d="M5 17v2M19 17v2"/>'),
    'Logistica & Spedizioni': SV('<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>'),
    'Farmacologia & Cosmesi': SV('<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5-9V3"/><path d="M7.5 15h9"/>'),
    'Servizi': SV('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>'),
    'Parcheggi': SV('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 010 5h-3"/>'),
    'Adeguamento Sismico': SV('<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M8 12h2l1.5-3 2 6 1.5-3h1"/>'),
    'Copertura Industriale': SV('<path d="M3 12l9-7 9 7"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>'),
    'Fotovoltaico': SV('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>'),
    'Efficientamento Energetico': SV('<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>'),
  };
  Promise.all([fetch('data/italy.json').then(r => r.json()), fetch('data/projects.json').then(r => r.json())]).then(([IT, P]) => {
    const proj = (lat, lon) => [(lon - IT.lon0) * IT.cx * IT.k, (IT.lat0 - lat) * IT.k];
    const norm = s => (s || '').replace('Emilia Romagna', 'Emilia-Romagna');
    const has = new Set(P.map(p => norm(p.r)).filter(Boolean));
    const gReg = mk('g', {}, svg), gLab = mk('g', {}, svg), gPins = mk('g', {}, svg);
    IT.regions.forEach(r => { mk('path', { d: r.d, class: 'reg' + (has.has(r.name) ? ' has' : '') }, gReg);
      if (has.has(r.name)) { const t = mk('text', { x: r.cx, y: r.cy, class: 'rlab' }, gLab); t.textContent = r.name.replace('Emilia-Romagna', 'Emilia R.'); } });

    // pin posizionati; piccolo scostamento se più progetti cadono nello stesso punto
    const groups = {};
    P.forEach((p, i) => { if (p.ll) { const key = p.ll.map(x => x.toFixed(3)).join(','); (groups[key] = groups[key] || []).push(i); } });
    const pins = [];
    Object.values(groups).forEach(list => list.forEach((i, j) => {
      const p = P[i], [x0, y0] = proj(p.ll[0], p.ll[1]);
      const a = j / list.length * Math.PI * 2 + .6, off = list.length > 1 ? Math.min(2.6 + list.length * .35, 6.5) : 0;
      const x = x0 + Math.cos(a) * off, y = y0 + Math.sin(a) * off;
      const g = mk('g', { class: 'pin ' + p.k }, gPins); g.style.setProperty('--i', pins.length);
      mk('circle', { class: 'halo', cx: x, cy: y, r: 3.4 }, g); mk('circle', { class: 'd', cx: x, cy: y, r: 3.4 }, g);
      g._p = p; g._xy = [x, y]; pins.push(g);
    }));

    /* filtri */
    const on = { n: true, r: true }, tags = new Set();
    const vis = p => on[p.k] && (!tags.size || p.g.some(t => tags.has(t)));
    const tagC = {}; P.forEach(p => p.g.forEach(t => { tagC[t] = (tagC[t] || 0) + 1; }));
    const tagList = Object.entries(tagC).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const chips = $('#chips');
    chips.innerHTML = tagList.map(t => `<button class="chip2" data-t="${t.replace(/"/g, '&quot;')}">${ICON[t] || ''}${t}<i>${tagC[t]}</i></button>`).join('');
    chips.addEventListener('click', e => { const b = e.target.closest('.chip2'); if (!b) return; const t = b.dataset.t; tags.has(t) ? tags.delete(t) : tags.add(t); b.classList.toggle('on', tags.has(t)); closePop(); refresh(); });
    const fh = $('#fh'), filt = $('#filt');
    fh.addEventListener('click', () => { if (innerWidth > 700) return; const o = !filt.classList.contains('open'); filt.classList.toggle('open', o); fh.setAttribute('aria-expanded', o); });
    function refresh() {
      pins.forEach(g => g.classList.toggle('hide', !vis(g._p)));
      const c = { n: 0, r: 0 }; P.forEach(p => { if (vis(p)) c[p.k]++; });
      $('#cN').textContent = fmtN(c.n); $('#cR').textContent = fmtN(c.r);
      document.querySelectorAll('#legend button').forEach(b => b.setAttribute('aria-pressed', on[b.dataset.k]));
      const rc = {}; P.forEach(p => { if (vis(p) && p.r) { const r = norm(p.r); rc[r] = rc[r] || { n: 0, r: 0 }; rc[r][p.k]++; } });
      const rows = Object.entries(rc).sort((a, b) => (b[1].n + b[1].r) - (a[1].n + a[1].r)), mx = Math.max(1, ...rows.map(r => r[1].n + r[1].r));
      $('#rbars').innerHTML = rows.slice(0, 7).map(([n, v]) => `<div class="rb"><span>${n}</span><div class="bar2"><i class="n" style="width:${v.n / mx * 100}%"></i><i class="r" style="width:${v.r / mx * 100}%"></i></div><em>${v.n + v.r}</em></div>`).join('') || '<div class="meta" style="color:var(--dim)">Nessun progetto con questi filtri.</div>';
      $('#fsum').textContent = tags.size === 0 ? 'Tutti i progetti' : tags.size === 1 ? [...tags][0] : `${tags.size} tipi selezionati`;
      if (selected && !vis(selected._p)) closePop();
    }
    document.querySelectorAll('#legend button').forEach(b => b.addEventListener('click', () => { on[b.dataset.k] = !on[b.dataset.k]; refresh(); }));
    const nN = P.filter(p => p.k === 'n').length, nR = P.length - nN, apx = P.filter(p => p.a).length, placed = P.filter(p => p.ll && !p.a).length, none = P.filter(p => !p.ll).length;
    $('#mnote').textContent = `${fmtN(nN)} nuove realizzazioni e ${fmtN(nR)} riqualificazioni pubblicate su manini.it. ${fmtN(placed)} hanno una località precisa; per ${fmtN(apx)} il sito indica solo la regione e il pin è nel capoluogo${none ? `; ${none} senza località non compare` : ''}.`;

    /* tooltip leggero + box sulla mappa al clic */
    const box = $('#mapbox'), tip = $('#mtip'), pop = $('#mpop');
    const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let selected = null;
    const showTip = (g, ev) => { if (selected) return; const r = box.getBoundingClientRect(); tip.innerHTML = `<b>${esc(g._p.t)}</b><i>${esc(g._p.l)}</i>`; let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14; if (x > r.width - 250) x = ev.clientX - r.left - 250; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, Math.min(y, r.height - 70)) + 'px'; tip.classList.add('on'); };
    function placePop() {
      if (!selected) return; const br = box.getBoundingClientRect(), cr = selected.querySelector('circle.d').getBoundingClientRect();
      const px = cr.left + cr.width / 2 - br.left, py = cr.top + cr.height / 2 - br.top;
      if (br.width < 520) { pop.classList.add('sheet'); pop.style.left = ''; pop.style.top = ''; return; }
      pop.classList.remove('sheet');
      const w = 276, h = pop.offsetHeight || 220;
      let x = px - w / 2, y = py - h - 16; if (y < 8) y = py + 18;
      pop.style.left = clamp(x, 8, br.width - w - 8) + 'px'; pop.style.top = clamp(y, 8, br.height - h - 8) + 'px';
    }
    function closePop() { if (selected) selected.classList.remove('sel'); selected = null; pop.classList.remove('on'); }
    function openPop(g) {
      if (selected) selected.classList.remove('sel'); selected = g; g.classList.add('sel'); tip.classList.remove('on');
      const p = g._p;
      pop.innerHTML = `<button class="x" aria-label="Chiudi">×</button><span class="bd ${p.k === 'n' ? 'n' : 'r'}">${p.k === 'n' ? 'Nuova realizzazione' : 'Riqualificazione'}</span><h4>${esc(p.t)}</h4><div class="loc">${esc(p.l || '')}${p.l && p.r ? ' · ' : ''}${esc(norm(p.r))}</div>`
        + `<div class="stats">${p.m ? `<div class="st"><span>Superficie</span><b>${esc(p.m)}</b></div>` : ''}${p.s ? `<div class="st"><span>Sistema</span><b>${esc(p.s)}</b></div>` : ''}${p.g && p.g[0] ? `<div class="st"><span>${p.k === 'n' ? 'Settore' : 'Intervento'}</span><b>${esc(p.g.slice(0, 2).join(' · '))}</b></div>` : ''}</div>`
        + (p.d ? `<p class="ds">${esc(p.d)}</p>` : '') + (p.a ? '<p class="ap">Località non indicata sul sito: pin nel capoluogo di regione.</p>' : '')
        + `<a href="${p.u}" target="_blank" rel="noopener">Scheda completa su manini.it ›</a>`;
      pop.classList.add('on'); placePop();
      pop.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); closePop(); });
    }
    pins.forEach(g => {
      g.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') showTip(g, ev); });
      g.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') showTip(g, ev); });
      g.addEventListener('pointerleave', () => tip.classList.remove('on'));
      g.addEventListener('click', e => { e.stopPropagation(); if (moved) return; openPop(g); });
    });
    svg.addEventListener('click', () => { if (!moved) closePop(); });
    pop.addEventListener('click', e => e.stopPropagation());

    /* zoom e pan */
    const VB0 = { x: -6, y: 0, w: 610, h: 786 }; let vb = { ...VB0 }, z = 1, moved = false;
    const apply = () => {
      svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
      z = VB0.w / vb.w; const r = 3.4 / Math.pow(z, .72);
      pins.forEach(g => g.querySelectorAll('circle').forEach(c => c.setAttribute('r', r)));
      gLab.style.opacity = z > 2.2 ? 0 : 1; placePop();
    };
    const zoomAt = (f, cx, cy) => {
      const nw = clamp(vb.w / f, VB0.w / 9, VB0.w), nh = nw * VB0.h / VB0.w;
      vb = { x: cx - (cx - vb.x) * nw / vb.w, y: cy - (cy - vb.y) * nh / vb.h, w: nw, h: nh };
      vb.x = clamp(vb.x, VB0.x - 20, VB0.x + VB0.w - vb.w + 20); vb.y = clamp(vb.y, -20, VB0.h - vb.h + 20); apply();
    };
    const toSvg = (px, py) => { const r = box.getBoundingClientRect(); return [vb.x + (px - r.left) / r.width * vb.w, vb.y + (py - r.top) / r.height * vb.h]; };
    $('#mzi').addEventListener('click', e => { e.stopPropagation(); zoomAt(1.6, vb.x + vb.w / 2, vb.y + vb.h / 2); });
    $('#mzo').addEventListener('click', e => { e.stopPropagation(); zoomAt(1 / 1.6, vb.x + vb.w / 2, vb.y + vb.h / 2); });
    $('#mz0').addEventListener('click', e => { e.stopPropagation(); vb = { ...VB0 }; apply(); });
    box.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const [cx, cy] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.25 : .8, cx, cy); }, { passive: false });
    box.addEventListener('dblclick', e => { if (e.target.closest('.mpop,.mleg,.mapctl')) return; const [cx, cy] = toSvg(e.clientX, e.clientY); zoomAt(1.8, cx, cy); });
    const ptrs = new Map(); let pinch = 0, sx = 0, sy = 0;
    box.addEventListener('pointerdown', e => { if (e.target.closest('.mpop,.mleg,.mapctl')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false; sx = e.clientX; sy = e.clientY; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
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
    const syncTouch = () => { box.style.touchAction = z > 1.001 ? 'none' : 'pan-y'; }; box.style.touchAction = 'pan-y';
    ['#mzi', '#mzo', '#mz0'].forEach(id => $(id).addEventListener('click', syncTouch)); box.addEventListener('dblclick', syncTouch);
    addEventListener('resize', placePop);

    new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { pins.forEach(g => g.classList.add('pop')); o.disconnect(); } }), { threshold: .25 }).observe(box);
    setTimeout(() => pins.forEach(g => g.classList.add('pop')), 5000);
    refresh(); apply();
  }).catch(err => { const n = document.getElementById('mnote'); if (n) n.textContent = 'Impossibile caricare i dati della mappa.'; console.error(err); });
})();
