(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (x === undefined || x === null || x !== x ? '—' : Number(x).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const inr = x => '₹' + fmt(x, 0);
  const pct = (x, d = 2) => (x > 0 ? '+' : '') + fmt(x, d) + '%';
  const cls = x => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
  const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 3000); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const debounce = (f, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => f(...a), ms); }; };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
  const STRATS = window.STRATEGIES, byId = Object.fromEntries(STRATS.map(s => [s.id, s]));
  const T = window.TA, LC = window.LightweightCharts;
  const chartOpts = h => ({ height: h, layout: { background: { color: '#121822' }, textColor: '#8592a8', fontSize: 11 }, grid: { vertLines: { color: '#1a2130' }, horzLines: { color: '#1a2130' } },
    rightPriceScale: { borderColor: '#232c3b' }, timeScale: { borderColor: '#232c3b' }, crosshair: { mode: 0 },
    handleScroll: { vertTouchDrag: false } });   // vertical swipes scroll the page on phones
  // Short axis labels for rupee amounts: ₹3.25 Cr, ₹12.4 L, ₹85,000
  const compactINR = v => { const a = Math.abs(v); return (v < 0 ? '-₹' : '₹') + (a >= 1e7 ? (a / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + ' L' : Math.round(a).toLocaleString('en-IN')); };
  const COLORS = ['#f5b544', '#a78bfa', '#22d3ee', '#f472b6', '#84cc16', '#fb923c', '#60a5fa', '#e879f9'];
  const line = (arr, B) => { const out = []; for (let i = 0; i < arr.length; i++) if (arr[i] === arr[i] && arr[i] != null && isFinite(arr[i])) out.push({ time: B.d[i], value: arr[i] }); return out; };

  // ═════════ DATA (current symbol first, the rest in the background) ═════════
  const DB = window.NPT_DATA.store, MAN = window.NPT_MANIFEST || [], NAMES = window.NPT_NAMES || {};
  function loadScript(src) { return new Promise((res, rej) => { const s = el('script', { src }); s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
  const manOf = sym => MAN.find(m => m.symbol === sym);
  const nameOf = sym => (manOf(sym) && manOf(sym).name) || (NAMES[sym] && NAMES[sym][0]) || sym;
  const kwOf = sym => (NAMES[sym] && NAMES[sym][1]) || '';
  const kindOf = sym => (DB[sym] && DB[sym].kind) || (manOf(sym) && manOf(sym).kind) || 'stock';
  const allSyms = () => [...new Set([...MAN.map(m => m.symbol), ...Object.keys(DB)])].sort((a, b) => (kindOf(a) === 'index') - (kindOf(b) === 'index') || a.localeCompare(b));
  const stockSyms = () => allSyms().filter(s => kindOf(s) !== 'index');
  async function ensure(sym) { if (DB[sym]) return DB[sym]; const m = manOf(sym); if (m) { try { await loadScript('data/' + m.file); } catch (e) { console.warn(e); } } return DB[sym]; }
  let loadedAll = null;
  function loadEverything() {
    if (loadedAll) return loadedAll;
    loadedAll = (async () => {
      const todo = MAN.filter(m => !DB[m.symbol]); const total = todo.length; let done = 0;
      const worker = async () => { while (todo.length) { const m = todo.shift(); try { await loadScript('data/' + m.file); } catch { } done++; if (done % 5 === 0 || done === total) $('dataStatus').textContent = `Loading data ${done}/${total}…`; } };
      await Promise.all([0, 1, 2, 3].map(worker)); await loadImported(); updateStatus();
    })();
    return loadedAll;
  }
  function updateStatus() {
    const syms = allSyms().filter(s => DB[s]); const last = syms.map(s => DB[s].d[DB[s].d.length - 1]).sort().pop();
    $('dataStatus').textContent = `${syms.length} instruments · data to ${last || '—'}`;
  }
  // IndexedDB for imported CSVs
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('npt', 1); r.onupgradeneeded = () => r.result.createObjectStore('series'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbAll() { try { const db = await idb(); return await new Promise(res => { const out = []; const c = db.transaction('series').objectStore('series').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value); cur.continue(); } else res(out); }; c.onerror = () => res([]); }); } catch { return []; } }
  async function idbPut(v) { try { const db = await idb(); db.transaction('series', 'readwrite').objectStore('series').put(v, v.symbol); } catch (e) { console.warn(e); } }
  async function idbClear() { try { const db = await idb(); db.transaction('series', 'readwrite').objectStore('series').clear(); } catch { } }
  async function loadImported() { (await idbAll()).forEach(v => { DB[v.symbol] = v; }); }
  const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  function parseDate(s) {
    s = s.trim().replace(/"/g, ''); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(MON[m[2].toUpperCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }
  function parseCSV(text, symbol) {
    const rows = text.split(/\r?\n/).filter(r => r.trim()); const hdr = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const idx = k => hdr.findIndex(h => k.some(x => h === x || h.startsWith(x)));
    const di = idx(['date', 'timestamp', 'datetime']), oi = idx(['open']), hi = idx(['high']), li = idx(['low']), ci = idx(['close', 'adj close', 'ltp']), vi = idx(['volume', 'shares traded', 'vol', 'qty']);
    if ([di, oi, hi, li, ci].some(x => x < 0)) throw new Error('need Date, Open, High, Low, Close columns');
    const recs = [];
    for (let r = 1; r < rows.length; r++) { const f = rows[r].split(',').map(x => x.replace(/"/g, '').trim()); const d = parseDate(f[di] || ''); const o = +f[oi], h = +f[hi], l = +f[li], c = +f[ci];
      if (!d || !(c > 0) || !(o > 0)) continue; recs.push({ d, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: vi >= 0 ? +f[vi] || 0 : 0 }); }
    recs.sort((a, b) => (a.d < b.d ? -1 : 1));
    const u = recs.filter((x, i) => !i || x.d !== recs[i - 1].d);
    return { symbol, kind: /NIFTY|SENSEX|INDEX|VIX/i.test(symbol) ? 'index' : 'stock', source: 'CSV import', d: u.map(x => x.d), o: u.map(x => x.o), h: u.map(x => x.h), l: u.map(x => x.l), c: u.map(x => x.c), v: u.map(x => x.v) };
  }
  const lastPx = sym => { const B = DB[sym]; return B ? B.c[B.c.length - 1] : NaN; };
  const dayChg = sym => { const B = DB[sym]; if (!B || B.c.length < 2) return NaN; const n = B.c.length; return (B.c[n - 1] / B.c[n - 2] - 1) * 100; };

  // ═════════ COMBOBOX (stock search + strategy pickers) ═════════
  function combo(input, box, { source, onPick, display }) {
    let items = [], idx = -1;
    const selectable = () => items.map((x, i) => (x.header ? -1 : i)).filter(i => i >= 0);
    const render = () => {
      box.innerHTML = items.length ? items.map((it, i) => it.header ? `<div class="dd-h">${it.header}</div>` : `<div class="dd-i ${i === idx ? 'on' : ''}" data-i="${i}"><div>${it.title}${it.sub ? `<span class="sub">${it.sub}</span>` : ''}</div><div class="r">${it.right || ''}</div></div>`).join('') : '<div class="dd-empty">No matches</div>';
      box.hidden = false; };
    const update = () => { items = source(input.value.trim()); const s = selectable(); idx = s.length ? s[0] : -1; render(); box.scrollTop = 0; };
    const restore = () => { input.value = display ? display() : ''; };
    input.addEventListener('focus', () => { input.value = ''; update(); });
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const s = selectable(); if (!s.length) return; let p = s.indexOf(idx); p = e.key === 'ArrowDown' ? Math.min(s.length - 1, p + 1) : Math.max(0, p - 1); idx = s[p]; render(); const on = box.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[idx] && !items[idx].header) pick(items[idx]); }
      else if (e.key === 'Escape') input.blur(); });
    box.addEventListener('mousedown', e => { const d = e.target.closest('.dd-i'); if (!d) return; e.preventDefault(); pick(items[+d.dataset.i]); });
    box.addEventListener('mousemove', e => { const d = e.target.closest('.dd-i'); if (d && +d.dataset.i !== idx) { idx = +d.dataset.i; box.querySelectorAll('.dd-i').forEach(x => x.classList.toggle('on', +x.dataset.i === idx)); } });
    input.addEventListener('blur', () => { box.hidden = true; restore(); });
    function pick(it) { onPick(it.value); input.blur(); }
    restore();
    return { refresh: restore };
  }
  const hl = (text, q) => { const t = esc(text); if (!q) return t; const i = text.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? t : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length)); };
  const subseq = (s, q) => { let j = 0; for (let i = 0; i < s.length && j < q.length; i++) if (s[i] === q[j]) j++; return j === q.length; };

  // ── stock search ──
  const recent = () => store.get('npt_recent', []);
  const pushRecent = s => store.set('npt_recent', [s, ...recent().filter(x => x !== s)].slice(0, 6));
  function stockItem(s, q) {
    const ch = dayChg(s), px = lastPx(s);
    return { value: s, title: `<b>${hl(s, q)}</b>`, sub: hl(nameOf(s), q), right: isFinite(px) ? `${fmt(px)} <span class="${cls(ch)}">${pct(ch)}</span>` : (kindOf(s) === 'index' ? '<span class="muted small">index</span>' : '') };
  }
  function scoreStock(s, Q) {
    const sl = s.toLowerCase(), n = nameOf(s).toLowerCase(), kw = kwOf(s).toLowerCase();
    if (sl === Q) return 100;
    if (sl.startsWith(Q)) return 90 - Math.min(sl.length - Q.length, 9);
    if (n.startsWith(Q)) return 80;
    if (n.split(/[\s()&.,-]+/).some(w => w && w.startsWith(Q))) return 70;
    if (kw.split(/\s+/).some(w => w && w.startsWith(Q))) return 60;
    if ((n + ' ' + kw).includes(Q)) return 50;
    if (sl.includes(Q)) return 45;
    const nq = Q.replace(/\s+/g, '');
    if (nq.length >= 2 && subseq(sl, nq)) return 15;
    return 0;
  }
  function stockSource(q) {
    const syms = allSyms();
    if (!q) {
      const out = []; const rec = recent().filter(s => syms.includes(s));
      if (rec.length) { out.push({ header: 'Recent' }); rec.forEach(s => out.push(stockItem(s))); }
      const mv = stockSyms().filter(s => DB[s]).map(s => ({ s, ch: dayChg(s) })).filter(x => isFinite(x.ch)).sort((a, b) => b.ch - a.ch);
      if (mv.length >= 8) { out.push({ header: 'Top gainers (latest day)' }); mv.slice(0, 4).forEach(x => out.push(stockItem(x.s))); out.push({ header: 'Top losers (latest day)' }); mv.slice(-4).reverse().forEach(x => out.push(stockItem(x.s))); }
      if (!out.length) { out.push({ header: 'All instruments' }); syms.slice(0, 12).forEach(s => out.push(stockItem(s))); }
      return out;
    }
    const Q = q.toLowerCase();
    return syms.map(s => ({ s, sc: scoreStock(s, Q) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc || a.s.localeCompare(b.s)).slice(0, 10).map(x => stockItem(x.s, q));
  }
  // ── strategy search ──
  function stratSource(q) {
    const Q = q.toLowerCase(); const item = (s, sub) => ({ value: s.id, title: hl(s.name, q), sub: sub || '', right: `<span class="tag">${s.cat}</span>` });
    if (!Q) { const out = []; let cat = ''; STRATS.forEach(s => { if (s.cat !== cat) { cat = s.cat; out.push({ header: cat }); } out.push(item(s)); }); return out; }
    return STRATS.map(s => { const n = s.name.toLowerCase(); const sc = n.startsWith(Q) ? 90 : n.split(/[\s(/-]+/).some(w => w.startsWith(Q)) ? 70 : n.includes(Q) ? 60 : s.author.toLowerCase().includes(Q) ? 40 : (s.cat + ' ' + s.desc).toLowerCase().includes(Q) ? 20 : 0; return { s, sc }; })
      .filter(x => x.sc).sort((a, b) => b.sc - a.sc).slice(0, 30).map(x => item(x.s, x.sc === 40 ? hl(x.s.author, q) : ''));
  }
  function stratPicker(inputId, ddId, initial, onPick, allowNone) {
    const st = { id: initial };
    const c = combo($(inputId), $(ddId), { source: q => { const r = stratSource(q); return allowNone && !q ? [{ value: '', title: '<span class="muted">None</span>' }, ...r] : r; },
      onPick: id => { st.id = id; onPick && onPick(id); }, display: () => (st.id && byId[st.id] ? byId[st.id].name : '') });
    if (!allowNone) $(inputId).placeholder = `Search ${STRATS.length} strategies…`;
    st.set = id => { st.id = id; c.refresh(); }; return st;
  }

  // ═════════ GLOBAL SYMBOL ═════════
  const S = { sym: null };
  async function setSymbol(sym) {
    if (!sym) return; await ensure(sym); if (!DB[sym]) return toast('No data for ' + sym);
    S.sym = sym; pushRecent(sym); store.set('npt_sym', sym); renderQuote();
    document.querySelectorAll('.curSym').forEach(e => (e.textContent = sym));
    const tab = activeTab();
    if (tab === 'backtest') runBacktest(true); else btDirty = true;
    if (tab === 'paper') renderPaper();
    if (tab === 'replay') rpLoad();
    if (tab === 'library') renderLibrary();
    if (tab === 'chart') cvRender();
  }
  function renderQuote() {
    const B = DB[S.sym]; if (!B) return; const n = B.c.length, px = B.c[n - 1], ch = dayChg(S.sym);
    const y = Math.max(0, n - 252); let hi = -Infinity, lo = Infinity; for (let i = y; i < n; i++) { if (B.h[i] > hi) hi = B.h[i]; if (B.l[i] < lo) lo = B.l[i]; } const r1 = (px / B.c[y] - 1) * 100;
    $('quote').innerHTML = `<span class="sym">${esc(S.sym)}</span><span class="nm" title="${esc(nameOf(S.sym))}">${esc(nameOf(S.sym))}</span><span class="px">${fmt(px)}</span><span class="${cls(ch)}">${pct(ch)}</span>
      <span class="muted small" title="52-week range and 1-year return">52W ${fmt(lo, 0)}–${fmt(hi, 0)} · 1Y <span class="${cls(r1)}">${pct(r1, 1)}</span></span>`;
  }
  // Picking a stock in the header search opens it in the Chart tab.
  combo($('stockSearch'), $('stockDD'), { source: stockSource, onPick: async s => { await setSymbol(s); gotoTab('chart'); }, display: () => '' });
  document.addEventListener('keydown', e => { if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('stockSearch').focus(); } });

  // ═════════ TABS ═════════
  const onTab = {}; let btDirty = false;
  const activeTab = () => document.querySelector('#tabs button.active').dataset.tab;
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return;
    document.querySelectorAll('#tabs button[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === 'tab-' + b.dataset.tab));
    b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    onTab[b.dataset.tab] && onTab[b.dataset.tab](); window.dispatchEvent(new Event('resize')); });
  const gotoTab = t => document.querySelector(`#tabs button[data-tab="${t}"]`).click();

  // ═════════ CHART HELPERS ═════════
  // Charts take their size from CSS (heights differ on phones vs desktop).
  function autoResize(chart, elm) { const ro = new ResizeObserver(() => { try { if (elm.clientWidth) chart.applyOptions({ width: elm.clientWidth, height: elm.clientHeight || undefined }); } catch { ro.disconnect(); } }); ro.observe(elm); return ro; }
  // Keep the tab bar pinned just under the header, whatever height the header wraps to.
  new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', document.querySelector('header').offsetHeight + 'px')).observe(document.querySelector('header'));
  function syncGroup() { const g = { list: [], busy: false,
      add(c) { g.list.push(c); c.timeScale().subscribeVisibleLogicalRangeChange(r => { if (g.busy || !r || !g.list.includes(c)) return; g.busy = true; g.list.forEach(o => { if (o !== c) try { o.timeScale().setVisibleLogicalRange(r); } catch { } }); g.busy = false; }); },
      remove(c) { g.list = g.list.filter(x => x !== c); } }; return g; }
  const candleOpts = { upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444' };

  // ═════════ BACKTEST ═════════
  const price = { chart: null, candles: null, vol: null, overlays: [], panes: [], sym: null };
  const equity = {};
  const activeInds = store.get('npt_inds', [{ id: 'ema', params: { period: 50 } }, { id: 'rsi', params: { period: 14 } }]).map(x => ({ def: INDICATORS.find(i => i.id === x.id), params: x.params })).filter(x => x.def);
  const saveInds = () => store.set('npt_inds', activeInds.map(x => ({ id: x.def.id, params: x.params })));
  let lastResult = null, range = store.get('npt_range', '1Y');
  function initCharts() {
    price.chart = LC.createChart($('priceChart'), chartOpts(440)); autoResize(price.chart, $('priceChart')); price.sync = syncGroup(); price.sync.add(price.chart);
    price.candles = price.chart.addCandlestickSeries(candleOpts);
    price.vol = price.chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    price.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    equity.chart = LC.createChart($('equityChart'), { ...chartOpts(260), localization: { priceFormatter: compactINR } }); autoResize(equity.chart, $('equityChart'));
    equity.bh = equity.chart.addLineSeries({ color: '#6b7280', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    equity.s = equity.chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0)', lineWidth: 2, priceLineVisible: false });
    equity.dd = LC.createChart($('ddChart'), { ...chartOpts(110), localization: { priceFormatter: v => v.toFixed(0) + '%' } }); autoResize(equity.dd, $('ddChart'));
    equity.dds = equity.dd.addAreaSeries({ lineColor: '#ef4444', topColor: 'rgba(239,68,68,0.05)', bottomColor: 'rgba(239,68,68,0.35)', lineWidth: 1, priceLineVisible: false, invertFilledArea: true });
    const g = syncGroup(); g.add(equity.chart); g.add(equity.dd);
  }
  function applyRange() {
    const B = DB[price.sym]; if (!B) return; document.querySelectorAll('#ranges button').forEach(b => b.classList.toggle('on', b.textContent === range));
    if (range === 'All') return price.chart.timeScale().fitContent();
    const days = { '1M': 31, '6M': 183, '1Y': 365, '3Y': 1096, '5Y': 1827 }[range]; const to = B.d[B.d.length - 1];
    const from = new Date(new Date(to).getTime() - days * 864e5).toISOString().slice(0, 10);
    try { price.chart.timeScale().setVisibleRange({ from: from < B.d[0] ? B.d[0] : from, to }); } catch { price.chart.timeScale().fitContent(); }
  }
  $('ranges').onclick = e => { if (e.target.tagName !== 'BUTTON') return; range = e.target.textContent; store.set('npt_range', range); applyRange(); };
  function drawPrice(B) {
    price.candles.setData(B.d.map((t, i) => ({ time: t, open: B.o[i], high: B.h[i], low: B.l[i], close: B.c[i] })));
    price.vol.setData(B.d.map((t, i) => ({ time: t, value: B.v[i], color: B.c[i] >= B.o[i] ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' })));
    price.sym = B.symbol; drawIndicators(B); applyRange();
  }
  function drawIndicators(B) {
    if (!B) return;
    price.overlays.forEach(s => price.chart.removeSeries(s)); price.overlays = [];
    price.panes.forEach(p => { price.sync.remove(p.chart); p.ro.disconnect(); p.chart.remove(); }); price.panes = []; $('paneCharts').innerHTML = '';
    let ci = 0;
    activeInds.forEach(ind => {
      const out = ind.def.calc(B, ind.params);
      if (ind.def.overlay) {
        Object.entries(out).forEach(([k, arr]) => { const s = price.chart.addLineSeries({ color: COLORS[ci++ % COLORS.length], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineVisible: !ind.def.dots, pointMarkersVisible: !!ind.def.dots, crosshairMarkerVisible: false }); s.setData(line(arr, B)); price.overlays.push(s); });
      } else {
        const box = el('div', { className: 'pane' }); box.appendChild(el('div', { className: 'lbl', textContent: ind.def.name + (ind.def.params.length ? ' (' + Object.values(ind.params).join(', ') + ')' : '') })); $('paneCharts').appendChild(box);
        const ch = LC.createChart(box, chartOpts(130)); const ro = autoResize(ch, box); let first = null, k2 = 0;
        Object.entries(out).forEach(([k, arr]) => {
          let s; if (ind.def.hist === k) { s = ch.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }); s.setData(line(arr, B).map(p => ({ ...p, color: p.value >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' }))); }
          else { s = ch.addLineSeries({ color: COLORS[k2++ % COLORS.length], lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false }); s.setData(line(arr, B)); }
          first = first || s; });
        (ind.def.levels || []).forEach(lv => first.createPriceLine({ price: lv, color: '#3a4558', lineWidth: 1, lineStyle: 2, axisLabelVisible: false }));
        price.panes.push({ chart: ch, ro }); price.sync.add(ch);
      }
    });
    const r = price.chart.timeScale().getVisibleLogicalRange(); if (r) price.panes.forEach(p => p.chart.timeScale().setVisibleLogicalRange(r));
    $('indChips').innerHTML = '';
    activeInds.forEach((ind, i) => { const c = el('span', { className: 'chip', title: 'Click to change settings' }, `${esc(ind.def.name.replace(/\s*\(.*\)/, ''))}${ind.def.params.length ? ' ' + Object.values(ind.params).join(',') : ''} <b title="Remove">✕</b>`);
      c.querySelector('b').onclick = ev => { ev.stopPropagation(); activeInds.splice(i, 1); saveInds(); drawIndicators(DB[price.sym]); };
      c.onclick = () => { if (!ind.def.params.length) return; const v = prompt(`${ind.def.name}\nSettings (${ind.def.params.map(p => p.name).join(', ')}):`, Object.values(ind.params).join(',')); if (v === null) return;
        v.split(',').forEach((x, k) => { const p = ind.def.params[k]; if (p && x.trim() !== '' && isFinite(+x)) ind.params[p.name] = +x; }); saveInds(); drawIndicators(DB[price.sym]); };
      $('indChips').appendChild(c); });
  }
  function initIndicatorPicker() {
    $('indPicker').innerHTML += '<optgroup label="On price chart">' + INDICATORS.filter(i => i.overlay).map(i => `<option value="${i.id}">${i.name}</option>`).join('') + '</optgroup><optgroup label="Below chart">' + INDICATORS.filter(i => !i.overlay).map(i => `<option value="${i.id}">${i.name}</option>`).join('') + '</optgroup>';
    $('indPicker').onchange = e => { const def = INDICATORS.find(i => i.id === e.target.value); e.target.value = ''; if (!def) return;
      const params = {}; def.params.forEach(p => (params[p.name] = p.def)); activeInds.push({ def, params }); saveInds(); drawIndicators(DB[price.sym]); };
  }
  const SETTING_IDS = ['setCapital', 'setAlloc', 'setCost', 'setSlip', 'setStop', 'setTarget', 'setTrail', 'setMaxHold', 'setStart', 'setEnd', 'setLongOnly'];
  function settings() {
    return { capital: +$('setCapital').value || 1e6, allocPct: +$('setAlloc').value || 100, costPct: +$('setCost').value, slipPct: +$('setSlip').value, stopPct: +$('setStop').value, targetPct: +$('setTarget').value,
      trailAtr: +$('setTrail').value, maxHold: +$('setMaxHold').value, longOnly: $('setLongOnly').checked, start: $('setStart').value, end: $('setEnd').value };
  }
  const savedSet = store.get('npt_settings', {});
  SETTING_IDS.forEach(id => { if (savedSet[id] !== undefined) { if (id === 'setLongOnly') $(id).checked = savedSet[id]; else $(id).value = savedSet[id]; }
    $(id).addEventListener(id === 'setLongOnly' ? 'change' : 'input', () => { const o = {}; SETTING_IDS.forEach(k => (o[k] = k === 'setLongOnly' ? $(k).checked : $(k).value)); store.set('npt_settings', o); autoRun(); }); });

  const btStrat = stratPicker('stratSearch', 'stratDD', byId[store.get('npt_strat', '')] ? store.get('npt_strat') : 'golden_cross', id => { store.set('npt_strat', id); showStrat(); runBacktest(); });
  function showStrat(params) {
    const s = byId[btStrat.id]; if (!s) return;
    const short = s.desc.length > 170 ? s.desc.slice(0, 150).replace(/\s\S*$/, '') + '… ' : s.desc;
    $('btStratInfo').innerHTML = `<div class="by">${esc(s.author)}</div><span id="descTxt">${esc(short)}</span>${short !== s.desc ? '<span class="more" id="descMore">more</span>' : ''}`;
    const m = $('descMore'); if (m) m.onclick = () => { $('descTxt').textContent = s.desc; m.remove(); };
    $('btParams').innerHTML = Object.entries(s.params).map(([k, v]) => `<label>${k}<input data-p="${k}" type="number" step="any" value="${params && params[k] !== undefined ? params[k] : v}"></label>`).join('');
    $('btParams').querySelectorAll('input').forEach(i => i.addEventListener('input', autoRun));
  }
  const readParams = box => Object.fromEntries([...box.querySelectorAll('input[data-p]')].map(i => [i.dataset.p, +i.value]));
  function selectStrategy(id, params) { btStrat.set(id); store.set('npt_strat', id); showStrat(params); }
  const autoRun = debounce(() => runBacktest(), 250);

  function runBacktest(newSymbol) {
    const B = DB[S.sym], s = byId[btStrat.id]; if (!B || !s) return;
    btDirty = false;
    const params = readParams($('btParams'));
    const pos = BT.strategyPositions(s, B, params), r = BT.run(B, pos, settings()); lastResult = { r, s, sym: S.sym, params };
    if (!r.dates.length) return toast('No data in the selected date range');
    $('btTitle').innerHTML = `${esc(s.name)} <span class="muted small">on ${esc(S.sym)} · ${r.dates[0]} → ${r.dates[r.dates.length - 1]}</span>`;
    if (newSymbol === true || price.sym !== S.sym) drawPrice(B);
    const mk = []; r.trades.forEach(t => { mk.push({ time: t.entryDate, position: t.side === 1 ? 'belowBar' : 'aboveBar', color: t.side === 1 ? '#22c55e' : '#f472b6', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', text: t.side === 1 ? 'B' : 'S' });
      mk.push({ time: t.exitDate, position: t.side === 1 ? 'aboveBar' : 'belowBar', color: t.ret >= 0 ? '#22c55e' : '#ef4444', shape: 'circle', text: (t.ret >= 0 ? '+' : '') + t.ret.toFixed(1) + '%' }); });
    mk.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)); price.candles.setMarkers(r.trades.length > 1500 ? [] : mk);
    const [a] = r.range; const cap = settings().capital;
    equity.s.setData(r.dates.map((d, i) => ({ time: d, value: r.equity[i] })));
    equity.bh.setData(r.dates.map((d, i) => ({ time: d, value: cap * B.c[a + i] / B.c[a] })));
    let pk = 0; equity.dds.setData(r.dates.map((d, i) => { pk = Math.max(pk, r.equity[i]); return { time: d, value: (r.equity[i] / pk - 1) * 100 }; }));
    equity.chart.timeScale().fitContent(); equity.dd.timeScale().fitContent();
    const m = r.metrics;
    metricCards($('headline'), [
      ['CAGR', pct(m.cagr), m.cagr, `Buy & hold ${pct(m.bhCagr)}`],
      ['Total return', pct(m.totalReturn, 1), m.totalReturn, `Final ${inr(m.finalEquity)}`],
      ['Max drawdown', fmt(m.maxDD, 1) + '%', -1, `Longest ${fmt(m.longestDDdays, 0)} bars`],
      ['Sharpe', fmt(m.sharpe), m.sharpe, `Sortino ${fmt(m.sortino)}`],
      ['Win rate', fmt(m.winRate, 1) + '%', undefined, `Profit factor ${fmt(m.profitFactor)}`],
      ['Trades', fmt(m.trades, 0), undefined, `${fmt(m.exposure, 0)}% time in market`]]);
    metricCards($('metrics'), [['Final equity', inr(m.finalEquity)], ['Total return', pct(m.totalReturn), m.totalReturn], ['CAGR', pct(m.cagr), m.cagr], ['Buy & hold CAGR', pct(m.bhCagr), m.bhCagr], ['Alpha vs B&H', pct(m.alpha), m.alpha],
      ['Max drawdown', fmt(m.maxDD) + '%', -1], ['Sharpe', fmt(m.sharpe), m.sharpe], ['Sortino', fmt(m.sortino), m.sortino], ['Calmar', fmt(m.calmar), m.calmar], ['Volatility', fmt(m.vol) + '%'],
      ['Trades', fmt(m.trades, 0)], ['Win rate', fmt(m.winRate, 1) + '%'], ['Profit factor', fmt(m.profitFactor)], ['Avg win', pct(m.avgWin), 1], ['Avg loss', pct(m.avgLoss), -1], ['Expectancy / trade', pct(m.expectancy), m.expectancy],
      ['Best trade', pct(m.best), 1], ['Worst trade', pct(m.worst), -1], ['Avg bars held', fmt(m.avgBars, 1)], ['Time in market', fmt(m.exposure, 1) + '%'], ['Max losing streak', fmt(m.maxLoseStreak, 0)], ['Longest drawdown', fmt(m.longestDDdays, 0) + ' bars'], ['Years tested', fmt(m.years, 1)], ['Buy & hold total', pct(m.bhReturn), m.bhReturn]]);
    $('tradesSummary').textContent = `Trades (${r.trades.length})`;
    renderTrades(r.trades);
  }
  function metricCards(box, items) { box.innerHTML = items.map(([k, v, c, sub]) => `<div class="metric"><div class="k">${k}</div><div class="v ${c !== undefined ? cls(c) : ''}">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`).join(''); }
  function renderTrades(tr) {
    const rows = tr.slice().reverse().slice(0, 2000).map((t, i) => `<tr><td>${tr.length - i}</td><td class="l">${t.side === 1 ? 'Long' : 'Short'}</td><td>${t.entryDate}</td><td>${fmt(t.entryPx)}</td><td>${t.exitDate}</td><td>${fmt(t.exitPx)}</td><td>${fmt(t.qty, 0)}</td><td class="${cls(t.pnl)}">${fmt(t.pnl, 0)}</td><td class="${cls(t.ret)}">${pct(t.ret)}</td><td>${t.bars}</td><td class="l muted">${t.reason}</td></tr>`).join('');
    $('tradesTable').innerHTML = `<tr><th>#</th><th class="l">Side</th><th>Entry</th><th>Entry ₹</th><th>Exit</th><th>Exit ₹</th><th>Qty</th><th>P&amp;L ₹</th><th>Return</th><th>Bars</th><th class="l">Exit reason</th></tr>` + rows;
  }
  $('btExport').onclick = () => { if (!lastResult) return; const t = lastResult.r.trades; const csv = 'side,entry_date,entry_px,exit_date,exit_px,qty,pnl,ret_pct,bars,reason\n' + t.map(x => [x.side, x.entryDate, x.entryPx.toFixed(2), x.exitDate, x.exitPx.toFixed(2), x.qty, x.pnl.toFixed(2), x.ret.toFixed(3), x.bars, x.reason].join(',')).join('\n');
    el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${lastResult.sym}_${lastResult.s.id}_trades.csv` }).click(); };
  onTab.backtest = () => { if (btDirty) runBacktest(true); };

  // ═════════ LIBRARY ═════════
  function renderLibrary() {
    const q = $('libSearch').value.toLowerCase(), c = $('libCat').value;
    const list = STRATS.filter(s => (!c || s.cat === c) && (!q || (s.name + s.author + s.desc).toLowerCase().includes(q)));
    $('libCount').textContent = `${list.length} of ${STRATS.length}`;
    $('libGrid').innerHTML = list.map(s => `<div class="scard" data-id="${s.id}"><div><span class="tag">${s.cat}</span> <span class="muted small">#${STRATS.indexOf(s) + 1}</span></div><h4>${esc(s.name)}</h4><div class="by">${esc(s.author)}</div><p>${esc(s.desc)}</p>
      <div class="small muted">${Object.keys(s.params).length ? 'Settings: ' + Object.entries(s.params).map(([k, v]) => k + ' ' + v).join(' · ') : 'No settings'}</div><div class="go">Test on ${esc(S.sym || '')} →</div></div>`).join('');
  }
  $('libGrid').onclick = e => { const c = e.target.closest('.scard'); if (!c) return; selectStrategy(c.dataset.id); gotoTab('backtest'); runBacktest(); };
  $('libSearch').oninput = debounce(renderLibrary, 120); $('libCat').onchange = renderLibrary;
  onTab.library = renderLibrary;

  // ═════════ SCANNER ═════════
  let scRows = [], scSort = { k: 'cagr', d: -1 }, scMode = 'strat', scView = 'strat';
  const scStrat = stratPicker('scStratSearch', 'scStratDD', 'connors_rsi2');
  const sigBadge = p => `<span class="badge ${p === 1 ? 'long' : p === -1 ? 'short' : 'flat'}">${p === 1 ? 'LONG' : p === -1 ? 'SHORT' : 'FLAT'}</span>`;
  $('scModes').onclick = e => { const b = e.target.closest('button'); if (!b) return; scMode = b.dataset.m; document.querySelectorAll('#scModes button').forEach(x => x.classList.toggle('on', x === b)); $('scStratWrap').style.display = scMode === 'strat' ? '' : 'none'; };
  async function runScan() {
    const opts = settings(), stocksOnly = $('scStocksOnly').checked;
    $('scRun').disabled = true; $('scStatus').textContent = 'Loading data…'; await loadEverything();
    const pool = stocksOnly ? stockSyms() : allSyms(); const jobs = [];
    if (scMode === 'strat') pool.forEach(sym => jobs.push([sym, scStrat.id]));
    else if (scMode === 'stock') STRATS.forEach(s => jobs.push([S.sym, s.id]));
    else pool.forEach(sym => STRATS.forEach(s => jobs.push([sym, s.id])));
    const res = []; const t0 = performance.now(); let tick = performance.now();
    for (let j = 0; j < jobs.length; j++) {
      const [sym, sid] = jobs[j], B = DB[sym], s = byId[sid]; if (!B) continue;
      try { const pos = BT.strategyPositions(s, B, {}), r = BT.run(B, pos, opts); const norm = x => (opts.longOnly && x < 0 ? 0 : x || 0); const last = norm(pos[pos.length - 1]), prev = norm(pos[pos.length - 2]);
        if (r.dates.length > 1) res.push({ sym, name: nameOf(sym), sid, sname: s.name, cat: s.cat, ...r.metrics, signal: last, changed: last !== prev }); } catch (e) { console.warn(sym, sid, e); }
      if (performance.now() - tick > 40) { tick = performance.now(); $('scProg').style.width = (100 * j / jobs.length) + '%'; $('scStatus').textContent = `${j} / ${jobs.length}`; await sleep(0); }
    }
    $('scRun').disabled = false; $('scProg').style.width = '100%'; $('scStatus').textContent = `${jobs.length} backtests in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    if (scMode === 'all') { const g = {}; res.forEach(r => { (g[r.sid] = g[r.sid] || []).push(r); });
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      scRows = Object.entries(g).map(([sid, rs]) => ({ sid, sname: byId[sid].name, cat: byId[sid].cat, n: rs.length, cagr: med(rs.map(r => r.cagr)), sharpe: med(rs.map(r => r.sharpe)), maxDD: med(rs.map(r => r.maxDD)), winRate: med(rs.map(r => r.winRate)), profitFactor: med(rs.map(r => Math.min(r.profitFactor, 20))), trades: med(rs.map(r => r.trades)), beat: 100 * rs.filter(r => r.alpha > 0).length / rs.length, longNow: rs.filter(r => r.signal === 1).length }));
      scSort = { k: 'sharpe', d: -1 };
    } else { scRows = res; scSort = { k: 'cagr', d: -1 }; }
    scView = scMode; renderScan();
  }
  function renderScan() {
    const cols = scView === 'all'
      ? [['sname', 'Strategy', 'l'], ['cat', 'Category', 'l'], ['cagr', 'Median CAGR %'], ['sharpe', 'Median Sharpe'], ['maxDD', 'Median max DD %'], ['winRate', 'Median win %'], ['profitFactor', 'Median PF'], ['trades', 'Median trades'], ['beat', '% beat buy & hold'], ['longNow', 'Long now'], ['n', 'Stocks']]
      : [...(scView === 'strat' ? [['sym', 'Symbol', 'l'], ['name', 'Company', 'l']] : [['sname', 'Strategy', 'l'], ['cat', 'Category', 'l']]), ['signal', 'Signal'], ['cagr', 'CAGR %'], ['bhCagr', 'B&H CAGR %'], ['alpha', 'Alpha %'], ['maxDD', 'Max DD %'], ['sharpe', 'Sharpe'], ['trades', 'Trades'], ['winRate', 'Win %'], ['profitFactor', 'PF'], ['years', 'Years']];
    const k = scSort.k, d = scSort.d; const rows = scRows.slice().sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) : (a[k] - b[k])) * d);
    $('scTable').innerHTML = '<tr>' + cols.map(([key, label, c]) => `<th data-k="${key}" class="${c || ''}${key === 'name' ? ' col-name' : ''}">${label}${key === k ? (d < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('') + '</tr>' +
      rows.map(r => `<tr data-sym="${esc(r.sym || '')}" data-sid="${r.sid}">` + cols.map(([key, , c]) => { const v = r[key]; if (key === 'signal') return `<td>${sigBadge(v)}${r.changed ? ' <span class="small" title="Signal changed on the latest bar">new</span>' : ''}</td>`;
        if (typeof v === 'string') return `<td class="l${key === 'name' || key === 'cat' ? ' muted' : ''}${key === 'name' ? ' col-name' : ''}">${esc(v)}</td>`; const dp = ['trades', 'n', 'longNow'].includes(key) ? 0 : 2; return `<td class="${['cagr', 'alpha', 'sharpe', 'bhCagr'].includes(key) ? cls(v) : ''}">${fmt(v, dp)}</td>`; }).join('') + '</tr>').join('');
  }
  $('scTable').onclick = async e => { const th = e.target.closest('th'); if (th) { const k = th.dataset.k; scSort = { k, d: scSort.k === k ? -scSort.d : -1 }; return renderScan(); }
    const tr = e.target.closest('tr[data-sid]'); if (!tr) return; selectStrategy(tr.dataset.sid); gotoTab('backtest'); if (tr.dataset.sym && tr.dataset.sym !== S.sym) await setSymbol(tr.dataset.sym); else runBacktest(); };
  $('scRun').onclick = runScan;

  // ═════════ OPTIMIZER ═════════
  const opStrat = stratPicker('opStratSearch', 'opStratDD', 'golden_cross', () => renderOpParams());
  function renderOpParams() {
    const s = byId[opStrat.id]; const ps = Object.entries(s.params);
    if (!ps.length) { $('opParams').innerHTML = '<span class="muted">This strategy has no settings to tune.</span>'; return; }
    $('opParams').innerHTML = ps.slice(0, 2).map(([k, v]) => { const int = Number.isInteger(v), lo = int ? Math.max(1, Math.round(v * 0.5)) : +(v * 0.5).toFixed(3), hi = int ? Math.round(v * 1.5) : +(v * 1.5).toFixed(3), st = int ? Math.max(1, Math.round((hi - lo) / 6)) : +((hi - lo) / 6).toFixed(3);
      return `<span><b>${k}</b> <label>from<input data-o="${k}" data-f="lo" type="number" step="any" value="${lo}" style="width:80px"></label> <label>to<input data-o="${k}" data-f="hi" type="number" step="any" value="${hi}" style="width:80px"></label> <label>step<input data-o="${k}" data-f="st" type="number" step="any" value="${st}" style="width:70px"></label></span>`; }).join(' &nbsp; ');
  }
  async function runOpt() {
    const s = byId[opStrat.id], B = DB[S.sym], metric = $('opMetric').value; if (!B) return;
    const keys = [...new Set([...$('opParams').querySelectorAll('[data-o]')].map(i => i.dataset.o))];
    const rng = k => { const g = f => +$('opParams').querySelector(`[data-o="${k}"][data-f="${f}"]`).value; const out = []; for (let x = g('lo'); x <= g('hi') + 1e-9 && out.length < 40; x += g('st') || 1) out.push(+x.toFixed(4)); return out; };
    const A = keys[0] ? rng(keys[0]) : [null], Bv = keys[1] ? rng(keys[1]) : [null]; const grid = []; let best = null; const opts = settings();
    for (let i = 0; i < A.length; i++) { grid.push([]); for (let j = 0; j < Bv.length; j++) { const p = {}; if (keys[0]) p[keys[0]] = A[i]; if (keys[1]) p[keys[1]] = Bv[j];
      const m = BT.run(B, BT.strategyPositions(s, B, p), opts).metrics; const v = m[metric]; grid[i].push({ v, m, p }); if (!best || v > best.v) best = { v, p, m }; }
      $('opStatus').textContent = `${(i + 1) * Bv.length} / ${A.length * Bv.length}`; await sleep(0); }
    const all = grid.flat().map(c => c.v).filter(isFinite), mn = Math.min(...all), mx = Math.max(...all);
    const color = v => { const t = mx > mn ? (v - mn) / (mx - mn) : 0.5; return `rgba(${Math.round(239 * (1 - t) + 34 * t)},${Math.round(68 * (1 - t) + 197 * t)},${Math.round(68 * (1 - t) + 94 * t)},0.5)`; };
    $('opGrid').innerHTML = `<p>Best ${esc($('opMetric').selectedOptions[0].text)}: <b>${fmt(best.v)}</b> with ${Object.entries(best.p).map(([k, v]) => `${k} = ${v}`).join(', ')} (CAGR ${pct(best.m.cagr)}, max DD ${fmt(best.m.maxDD)}%, ${best.m.trades} trades). Click a cell to open it in Backtest.</p>` +
      `<table class="heat"><tr><th>${keys[0] || ''} ↓ &nbsp; ${keys[1] || ''} →</th>${Bv.map(b => `<th>${b ?? ''}</th>`).join('')}</tr>` + grid.map((row, i) => `<tr><th>${A[i] ?? ''}</th>${row.map((c, j) => `<td data-i="${i}" data-j="${j}" style="background:${color(c.v)}" title="CAGR ${fmt(c.m.cagr)}% · Sharpe ${fmt(c.m.sharpe)} · DD ${fmt(c.m.maxDD)}% · trades ${c.m.trades}">${fmt(c.v)}</td>`).join('')}</tr>`).join('') + '</table>';
    $('opGrid').onclick = e => { const td = e.target.closest('td[data-i]'); if (!td) return; const c = grid[+td.dataset.i][+td.dataset.j]; selectStrategy(s.id, c.p); gotoTab('backtest'); runBacktest(); };
  }
  $('opRun').onclick = runOpt;

  // ═════════ PAPER TRADING ═════════
  const PKEY = 'npt_paper_v1';
  const newAcct = () => ({ start: 1000000, cash: 1000000, pos: {}, orders: [], hist: [], seq: 1 });
  let acct = store.get(PKEY, null) || newAcct();
  const save = () => store.set(PKEY, acct);
  const ltp = sym => { const B = DB[sym]; return B ? { px: B.c[B.c.length - 1], date: B.d[B.d.length - 1] } : null; };
  const COST = () => (+$('setCost').value || 0) / 100;
  let ptSide = 'BUY';
  $('ptSideSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; ptSide = b.dataset.v; document.querySelectorAll('#ptSideSeg button').forEach(x => { x.classList.toggle('on', x === b); x.classList.toggle('buyon', x === b && ptSide === 'BUY'); x.classList.toggle('sellon', x === b && ptSide === 'SELL'); }); $('ptPlace').textContent = ptSide === 'BUY' ? 'Place buy order' : 'Place sell order'; };
  $('ptType').onchange = () => { $('ptPriceWrap').style.display = $('ptType').value === 'MARKET' ? 'none' : ''; updateLtp(); };
  $('ptQty').oninput = () => updateLtp(); $('ptPrice').oninput = () => updateLtp();
  function fill(o, px, date) {
    const value = o.qty * px, fee = value * COST(); const p = acct.pos[o.sym] || { qty: 0, avg: 0 };
    if (o.side === 'BUY') { if (value + fee > acct.cash) { o.status = 'REJECTED'; o.note = 'insufficient cash'; return; } acct.cash -= value + fee; p.avg = (p.avg * p.qty + value) / (p.qty + o.qty); p.qty += o.qty; }
    else { if (o.qty > p.qty) { o.status = 'REJECTED'; o.note = 'cannot sell more than held'; return; } acct.cash += value - fee; o.realized = (px - p.avg) * o.qty - fee; p.qty -= o.qty; if (!p.qty) p.avg = 0; }
    if (p.qty) acct.pos[o.sym] = p; else delete acct.pos[o.sym];
    Object.assign(o, { status: 'FILLED', fillPx: px, fillDate: date, fee });
  }
  function placeOrder(sym, side, type, qty, price, note, quiet) {
    const q = ltp(sym); if (!q) return toast('No data for ' + sym); if (!(qty > 0)) return toast('Quantity must be more than 0');
    const o = { id: acct.seq++, sym, side, type, qty, price: +price || null, placed: q.date, status: 'OPEN', note: note || '' };
    if (type === 'MARKET') fill(o, q.px, q.date); else if (!(o.price > 0)) return toast('Enter a limit/stop price');
    acct.orders.unshift(o); save(); if (!quiet) { renderPaper(); toast(`${side} ${qty} ${sym}: ${o.status.toLowerCase()}${o.fillPx ? ' at ₹' + fmt(o.fillPx) : ''}`); }
  }
  function processPending() {
    let changed = false;
    acct.orders.filter(o => o.status === 'OPEN').sort((a, b) => a.id - b.id).forEach(o => { const B = DB[o.sym]; if (!B) return;
      for (let i = 0; i < B.d.length; i++) { if (B.d[i] <= o.placed) continue; let px = null;
        if (o.type === 'LIMIT') { if (o.side === 'BUY' && B.l[i] <= o.price) px = Math.min(B.o[i], o.price); if (o.side === 'SELL' && B.h[i] >= o.price) px = Math.max(B.o[i], o.price); }
        else if (o.type === 'SL') { if (o.side === 'BUY' && B.h[i] >= o.price) px = Math.max(B.o[i], o.price); if (o.side === 'SELL' && B.l[i] <= o.price) px = Math.min(B.o[i], o.price); }
        if (px !== null) { fill(o, px, B.d[i]); changed = true; break; } } });
    if (changed) save();
  }
  function snapshot() { const dates = Object.keys(acct.pos).map(s => ltp(s)?.date).filter(Boolean); if (S.sym && DB[S.sym]) dates.push(ltp(S.sym).date); const asOf = dates.sort().pop();
    let mv = 0; for (const [s, p] of Object.entries(acct.pos)) mv += p.qty * (ltp(s)?.px || p.avg); const eq = acct.cash + mv;
    if (asOf) { const h = acct.hist; if (h.length && h[h.length - 1].time === asOf) h[h.length - 1].value = eq; else if (!h.length || h[h.length - 1].time < asOf) h.push({ time: asOf, value: eq }); }
    return { mv, eq }; }
  let ptChart, ptSeries;
  async function renderPaper() {
    await Promise.all(Object.keys(acct.pos).concat(acct.orders.filter(o => o.status === 'OPEN').map(o => o.sym)).map(ensure));
    processPending(); const { mv, eq } = snapshot(); save();
    const realized = acct.orders.reduce((s, o) => s + (o.realized || 0), 0); let unreal = 0; Object.entries(acct.pos).forEach(([s, p]) => (unreal += p.qty * ((ltp(s)?.px || p.avg) - p.avg)));
    metricCards($('ptAccount'), [['Account value', inr(eq), undefined, `Started with ${inr(acct.start)}`], ['Total P&L', inr(eq - acct.start), eq - acct.start, pct((eq / acct.start - 1) * 100)], ['Cash', inr(acct.cash)], ['Invested', inr(mv), undefined, `${Object.keys(acct.pos).length} holdings`], ['Realised', inr(realized), realized], ['Unrealised', inr(unreal), unreal]]);
    $('ptHoldings').innerHTML = Object.keys(acct.pos).length ? '<tr><th class="l">Symbol</th><th>Qty</th><th>Avg ₹</th><th>LTP ₹</th><th>Day</th><th>Value ₹</th><th>P&amp;L ₹</th><th>P&amp;L %</th><th></th></tr>' + Object.entries(acct.pos).map(([s, p]) => { const l = ltp(s)?.px || p.avg, dc = dayChg(s), pl = (l - p.avg) * p.qty;
      return `<tr><td class="l"><b>${esc(s)}</b> <span class="muted small">${esc(nameOf(s))}</span></td><td>${p.qty}</td><td>${fmt(p.avg)}</td><td>${fmt(l)}</td><td class="${cls(dc)}">${pct(dc)}</td><td>${fmt(l * p.qty, 0)}</td><td class="${cls(pl)}">${fmt(pl, 0)}</td><td class="${cls(pl)}">${pct((l / p.avg - 1) * 100)}</td><td><button data-exit="${esc(s)}">Exit</button></td></tr>`; }).join('')
      : '<tr><td class="muted" style="text-align:center;padding:24px">No holdings yet. Search a stock at the top and place a buy order.</td></tr>';
    $('ptOrders').innerHTML = '<tr><th>#</th><th class="l">Placed</th><th class="l">Symbol</th><th class="l">Side</th><th class="l">Type</th><th>Qty</th><th>Price</th><th class="l">Status</th><th>Fill ₹</th><th class="l">Filled</th><th>Realised ₹</th><th class="l">Note</th><th></th></tr>' + acct.orders.slice(0, 500).map(o => `<tr><td>${o.id}</td><td class="l">${o.placed}</td><td class="l">${esc(o.sym)}</td><td class="l ${o.side === 'BUY' ? 'pos' : 'neg'}">${o.side}</td><td class="l">${o.type}</td><td>${o.qty}</td><td>${o.price ? fmt(o.price) : '—'}</td><td class="l">${o.status}</td><td>${o.fillPx ? fmt(o.fillPx) : '—'}</td><td class="l">${o.fillDate || ''}</td><td class="${cls(o.realized)}">${o.realized ? fmt(o.realized, 0) : ''}</td><td class="l small muted">${esc(o.note || '')}</td><td>${o.status === 'OPEN' ? `<button data-cancel="${o.id}">Cancel</button>` : ''}</td></tr>`).join('');
    if (!ptChart) { ptChart = LC.createChart($('ptEquity'), { ...chartOpts(260), localization: { priceFormatter: compactINR } }); autoResize(ptChart, $('ptEquity')); ptSeries = ptChart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0)', priceLineVisible: false }); }
    ptSeries.setData(acct.hist); ptChart.timeScale().fitContent(); updateLtp();
    let note = $('ptEqNote'); if (!note) { note = el('div', { id: 'ptEqNote', className: 'muted small' }); $('ptEquity').before(note); }
    note.textContent = acct.hist.length < 2 ? 'The equity curve builds up day by day as you update data and revisit this tab.' : '';
  }
  function updateLtp() { const q = ltp(S.sym); if (!q) return; const ch = dayChg(S.sym); $('ptLtp').innerHTML = `₹${fmt(q.px)} <span class="small ${cls(ch)}">${pct(ch)}</span> <span class="muted small">close on ${q.date}</span>`;
    const px = $('ptType').value === 'MARKET' ? q.px : +$('ptPrice').value || q.px; $('ptValue').value = inr((+$('ptQty').value || 0) * px); }
  $('ptPlace').onclick = () => placeOrder(S.sym, ptSide, $('ptType').value, Math.floor(+$('ptQty').value), $('ptPrice').value);
  $('ptHoldings').onclick = e => { const s = e.target.dataset.exit; if (s) placeOrder(s, 'SELL', 'MARKET', acct.pos[s].qty, null, 'manual exit'); };
  $('ptOrders').onclick = e => { const id = +e.target.dataset.cancel; if (!id) return; const o = acct.orders.find(x => x.id === id); o.status = 'CANCELLED'; save(); renderPaper(); };
  $('ptReset').onclick = () => { const v = prompt('Reset the paper account. Starting capital ₹:', acct.start); if (v === null) return; acct = newAcct(); acct.start = acct.cash = +v || 1000000; save(); renderPaper(); toast('Account reset'); };
  const apStrat = stratPicker('apStratSearch', 'apStratDD', 'supertrend_ema');
  $('apRun').onclick = async () => {
    $('apLog').textContent = 'Loading data…'; await loadEverything();
    const s = byId[apStrat.id], alloc = +$('apAlloc').value; const uni = $('apUniverse').value === 'sel' ? [S.sym] : stockSyms(); const log = [];
    uni.forEach(sym => { const B = DB[sym]; if (!B) return; const pos = BT.strategyPositions(s, B, {}); const sig = pos[pos.length - 1]; const held = acct.pos[sym]?.qty || 0;
      if (sig === 1 && !held) { const q = Math.floor(alloc / B.c[B.c.length - 1]); if (q > 0) { placeOrder(sym, 'BUY', 'MARKET', q, null, 'autopilot: ' + s.name, true); log.push(`Bought ${q} ${sym}`); } }
      else if (sig !== 1 && held) { placeOrder(sym, 'SELL', 'MARKET', held, null, 'autopilot: ' + s.name, true); log.push(`Sold ${held} ${sym}`); } });
    renderPaper();
    $('apLog').textContent = log.length ? log.join(' · ') : 'No changes. Your holdings already match the signals.'; toast(`Autopilot placed ${log.length} order(s)`);
  };
  onTab.paper = renderPaper;

  // ═════════ REPLAY ═════════
  const rp = { B: null, i: 0, timer: null, pos: 0, qty: 0, entry: 0, cash: 1000000, trades: [], pending: null, series: {} };
  let rpChart, rpCandles, rpRsiChart, rpRsi;
  const rpHint = stratPicker('rpHintSearch', 'rpHintDD', '', id => { if (rp.B) { rp.hintPos = id ? BT.strategyPositions(byId[id], rp.B, {}) : null; rpDraw(false); } }, true);
  function rpInit() { if (rpChart) return; rpChart = LC.createChart($('rpChart'), chartOpts(440)); autoResize(rpChart, $('rpChart'));
    rpCandles = rpChart.addCandlestickSeries(candleOpts);
    rpRsiChart = LC.createChart($('rpRsi'), chartOpts(110)); autoResize(rpRsiChart, $('rpRsi')); rpRsi = rpRsiChart.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceLineVisible: false, title: 'RSI 14' });
    [30, 70].forEach(v => rpRsi.createPriceLine({ price: v, color: '#3a4558', lineWidth: 1, lineStyle: 2, axisLabelVisible: false })); const g = syncGroup(); g.add(rpChart); g.add(rpRsiChart); }
  function rpLoad() {
    rpInit(); rpPause(); const B = DB[S.sym]; if (!B) return; rp.B = B; let s = 0; const sd = $('rpStart').value; if (sd) while (s < B.d.length - 1 && B.d[s] < sd) s++; else s = Math.max(0, B.d.length - 250);
    Object.assign(rp, { i: Math.max(s, Math.min(50, B.d.length - 1)), pos: 0, qty: 0, entry: 0, cash: 1000000, trades: [], pending: null });
    rp.ind = { ema20: T.ema(B.c, 20), ema50: T.ema(B.c, 50), sma200: T.sma(B.c, 200), bb: T.bollinger(B.c, 20, 2), st: T.supertrend(B, 10, 3).st, rsi: T.rsi(B.c, 14) };
    Object.values(rp.series).flat().forEach(x => rpChart.removeSeries(x)); rp.series = {};
    rp.hintPos = rpHint.id ? BT.strategyPositions(byId[rpHint.id], B, {}) : null;
    rpDraw(true);
  }
  function rpDraw(full) {
    const B = rp.B, i = rp.i; if (!B) return; const sl = a => { const out = []; for (let k = 0; k <= i; k++) if (a[k] === a[k] && isFinite(a[k])) out.push({ time: B.d[k], value: a[k] }); return out; };
    if (full) rpCandles.setData(B.d.slice(0, i + 1).map((t, k) => ({ time: t, open: B.o[k], high: B.h[k], low: B.l[k], close: B.c[k] })));
    else rpCandles.update({ time: B.d[i], open: B.o[i], high: B.h[i], low: B.l[i], close: B.c[i] });
    const want = [...document.querySelectorAll('.rpInd:checked')].map(x => x.value);
    Object.keys(rp.series).forEach(k => { if (!want.includes(k)) { rp.series[k].forEach(s => rpChart.removeSeries(s)); delete rp.series[k]; } });
    want.forEach((k, n) => { const arrs = k === 'bb' ? [rp.ind.bb.up, rp.ind.bb.mid, rp.ind.bb.lo] : [rp.ind[k]];
      if (!rp.series[k]) { rp.series[k] = arrs.map(() => rpChart.addLineSeries({ color: COLORS[n % COLORS.length], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })); rp.series[k].forEach((s, j) => s.setData(sl(arrs[j]))); }
      else if (full) rp.series[k].forEach((s, j) => s.setData(sl(arrs[j])));
      else rp.series[k].forEach((s, j) => { const v = arrs[j][i]; if (v === v && isFinite(v)) s.update({ time: B.d[i], value: v }); }); });
    if (full) rpRsi.setData(sl(rp.ind.rsi)); else if (rp.ind.rsi[i] === rp.ind.rsi[i]) rpRsi.update({ time: B.d[i], value: rp.ind.rsi[i] });
    rpCandles.setMarkers(rp.trades.flatMap(t => [{ time: t.ed, position: t.side === 1 ? 'belowBar' : 'aboveBar', color: t.side === 1 ? '#22c55e' : '#f472b6', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', text: t.side === 1 ? 'B' : 'S' }].concat(t.xd ? [{ time: t.xd, position: 'aboveBar', color: t.ret >= 0 ? '#22c55e' : '#ef4444', shape: 'circle', text: fmt(t.ret, 1) + '%' }] : [])).sort((a, b) => (a.time < b.time ? -1 : 1)));
    if (full) rpChart.timeScale().setVisibleLogicalRange({ from: i - 150, to: i + 10 });
    $('rpDate').textContent = B.d[i] + (i >= B.d.length - 1 ? ' (end)' : '');
    const mtm = rp.pos ? rp.pos * rp.qty * (B.c[i] - rp.entry) : 0; const eq = rp.cash + mtm;
    $('rpAcct').innerHTML = `${rp.pos ? (rp.pos > 0 ? 'Long ' : 'Short ') + rp.qty + ' @ ' + fmt(rp.entry) : 'No position'} · Open P&amp;L <b class="${cls(mtm)}">${fmt(mtm, 0)}</b> · Equity <b class="${cls(eq - 1e6)}">${inr(eq)}</b>${rp.pending ? ' · <span class="muted">' + rp.pending.type.toLowerCase() + ' at next open</span>' : ''}`;
    if (rp.hintPos) { const p = rp.hintPos[i]; $('rpHintOut').className = 'badge ' + (p === 1 ? 'long' : p === -1 ? 'short' : 'flat'); $('rpHintOut').textContent = p === 1 ? 'LONG' : p === -1 ? 'SHORT' : 'FLAT'; } else { $('rpHintOut').textContent = ''; $('rpHintOut').className = ''; }
    $('rpTrades').innerHTML = '<tr><th class="l">Side</th><th>Entry</th><th>Entry ₹</th><th>Exit</th><th>Exit ₹</th><th>Qty</th><th>P&amp;L ₹</th><th>Return</th></tr>' + rp.trades.slice().reverse().map(t => `<tr><td class="l">${t.side > 0 ? 'Long' : 'Short'}</td><td>${t.ed}</td><td>${fmt(t.ep)}</td><td>${t.xd || ''}</td><td>${t.xp ? fmt(t.xp) : ''}</td><td>${t.qty}</td><td class="${cls(t.pnl)}">${t.pnl !== undefined ? fmt(t.pnl, 0) : ''}</td><td class="${cls(t.ret)}">${t.ret !== undefined ? pct(t.ret) : ''}</td></tr>`).join('');
  }
  function rpStep(dir = 1) {
    const B = rp.B; if (!B) return; if (dir < 0) { if (rp.i > 50) { rp.i--; rpDraw(true); } return; }
    if (rp.i >= B.d.length - 1) { rpPause(); return toast('End of data'); }
    rp.i++; const i = rp.i, px = B.o[i], cost = COST();
    if (rp.pending) { const pd = rp.pending; rp.pending = null;
      const closePos = () => { const pnl = rp.pos * rp.qty * (px - rp.entry) - rp.qty * px * cost; rp.cash += pnl; const t = rp.trades[rp.trades.length - 1]; Object.assign(t, { xd: B.d[i], xp: px, pnl, ret: rp.pos * (px / rp.entry - 1) * 100 }); rp.pos = 0; rp.qty = 0; };
      if (pd.type === 'CLOSE' && rp.pos) closePos();
      else if (pd.type === 'BUY' || pd.type === 'SELL') { const side = pd.type === 'BUY' ? 1 : -1; if (rp.pos === -side) closePos(); else if (rp.pos === side) toast('Already in that position');
        if (!rp.pos) { rp.pos = side; rp.qty = pd.qty; rp.entry = px; rp.cash -= pd.qty * px * cost; rp.trades.push({ side, ed: B.d[i], ep: px, qty: pd.qty }); } } }
    rpDraw(false);
  }
  function rpPause() { clearInterval(rp.timer); rp.timer = null; $('rpPlay').textContent = '▶ Play'; }
  $('rpLoad').onclick = rpLoad; $('rpStart').onchange = rpLoad; $('rpStep').onclick = () => rpStep(1); $('rpBack').onclick = () => rpStep(-1);
  $('rpPlay').onclick = () => { if (rp.timer) return rpPause(); if (!rp.B) rpLoad(); rp.timer = setInterval(() => rpStep(1), +$('rpSpeed').value); $('rpPlay').textContent = '⏸ Pause'; };
  $('rpSpeed').onchange = () => { if (rp.timer) { rpPause(); $('rpPlay').click(); } };
  $('rpBuy').onclick = () => { rp.pending = { type: 'BUY', qty: +$('rpQty').value }; rpDraw(false); };
  $('rpSell').onclick = () => { rp.pending = { type: 'SELL', qty: +$('rpQty').value }; rpDraw(false); };
  $('rpFlat').onclick = () => { rp.pending = { type: 'CLOSE' }; rpDraw(false); };
  document.querySelectorAll('.rpInd').forEach(c => (c.onchange = () => rp.B && rpDraw(true)));
  document.addEventListener('keydown', e => { if (activeTab() !== 'replay' || /INPUT|SELECT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') rpStep(1); if (e.key === 'ArrowLeft') rpStep(-1); if (e.key === 'b') $('rpBuy').click(); if (e.key === 's') $('rpSell').click(); });
  onTab.replay = () => { rpInit(); if (!rp.B || rp.B.symbol !== S.sym) rpLoad(); };

  // ═════════ DATA TAB ═════════
  async function renderData() {
    if (!loadedAll) $('dataTable').innerHTML = '<tr><td class="muted">Loading…</td></tr>'; await loadEverything();
    $('dataTable').innerHTML = '<tr><th class="l">Symbol</th><th class="l">Name</th><th class="l">Type</th><th class="l">From</th><th class="l">To</th><th>Bars</th><th>Years</th><th>Last close</th><th class="l">Source</th></tr>' +
      allSyms().filter(s => DB[s]).map(s => { const B = DB[s], n = B.d.length; return `<tr><td class="l"><b>${esc(s)}</b></td><td class="l muted">${esc(nameOf(s))}</td><td class="l">${B.kind}</td><td class="l">${B.d[0]}</td><td class="l">${B.d[n - 1]}</td><td>${fmt(n, 0)}</td><td>${fmt((new Date(B.d[n - 1]) - new Date(B.d[0])) / 31557600000, 1)}</td><td>${fmt(B.c[n - 1])}</td><td class="l small muted">${esc(B.source || '')}</td></tr>`; }).join('');
  }
  $('csvFiles').onchange = async e => { let ok = 0, lastSym; for (const f of e.target.files) { try { const sym = f.name.replace(/\.(csv|txt)$/i, '').replace(/[^A-Za-z0-9&_-]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase(); const s = parseCSV(await f.text(), sym); if (s.d.length < 2) throw new Error('no rows'); DB[sym] = s; await idbPut(s); ok++; lastSym = sym; } catch (err) { toast(f.name + ': ' + err.message); } }
    renderData(); updateStatus(); if (ok) toast(`Imported ${ok} file(s). Search "${lastSym}" to open it.`); };
  $('clearImported').onclick = async () => { if (!confirm('Delete all CSV-imported series from this browser?')) return; await idbClear(); location.reload(); };
  onTab.data = renderData;

  // ═════════ CHART VIEW: full chart with indicators, chart types and drawing ═════════
  const cv = { chart: null, main: null, vol: null, overlays: [], panes: [], lineObjs: [], sym: null, idx: new Map(), drawing: false,
    type: store.get('npt_cv_type', 'candle'), range: store.get('npt_cv_range', '1Y') };
  const cvInds = store.get('npt_cv_inds', [{ id: 'ema', params: { period: 20 } }, { id: 'ema', params: { period: 50 } }, { id: 'rsi', params: { period: 14 } }])
    .map(x => ({ def: INDICATORS.find(i => i.id === x.id), params: x.params })).filter(x => x.def);
  const cvSaveInds = () => store.set('npt_cv_inds', cvInds.map(x => ({ id: x.def.id, params: x.params })));
  const cvLines = () => store.get('npt_cv_lines', {});
  const fmtVol = v => (v >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' : v >= 1e5 ? (v / 1e5).toFixed(2) + ' L' : fmt(v, 0));
  function cvInit() {
    if (cv.chart) return;
    cv.chart = LC.createChart($('cvChart'), chartOpts(520)); autoResize(cv.chart, $('cvChart')); cv.sync = syncGroup(); cv.sync.add(cv.chart);
    cv.vol = cv.chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    cv.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    cv.chart.subscribeCrosshairMove(cvLegend);
    cv.chart.subscribeClick(p => {
      if (!cv.drawing || !p.point || !cv.main) return;
      const price = cv.main.coordinateToPrice(p.point.y); if (price == null || !isFinite(price)) return;
      const all = cvLines(); (all[cv.sym] = all[cv.sym] || []).push(+price.toFixed(2)); store.set('npt_cv_lines', all);
      cvSetDrawing(false); cvDrawLines(); toast('Line added at ₹' + fmt(price));
    });
    $('cvIndPicker').innerHTML += '<optgroup label="On price chart">' + INDICATORS.filter(i => i.overlay).map(i => `<option value="${i.id}">${i.name}</option>`).join('') + '</optgroup><optgroup label="Below chart">' + INDICATORS.filter(i => !i.overlay).map(i => `<option value="${i.id}">${i.name}</option>`).join('') + '</optgroup>';
    $('cvIndPicker').onchange = e => { const def = INDICATORS.find(i => i.id === e.target.value); e.target.value = ''; if (!def) return;
      const params = {}; def.params.forEach(p => (params[p.name] = p.def)); cvInds.push({ def, params }); cvSaveInds(); cvDrawInds(DB[cv.sym]); };
    $('cvType').onclick = e => { const b = e.target.closest('button'); if (!b) return; cv.type = b.dataset.t; store.set('npt_cv_type', cv.type); const r = cv.chart.timeScale().getVisibleLogicalRange(); cvMakeSeries(DB[cv.sym]); if (r) cv.chart.timeScale().setVisibleLogicalRange(r); };
    $('cvRanges').onclick = e => { if (e.target.tagName !== 'BUTTON') return; cv.range = e.target.textContent; store.set('npt_cv_range', cv.range); cvApplyRange(); };
    $('cvVol').onchange = () => cv.vol.applyOptions({ visible: $('cvVol').checked });
    $('cvLog').onchange = () => cv.chart.priceScale('right').applyOptions({ mode: $('cvLog').checked ? 1 : 0 });
    $('cvDraw').onclick = () => cvSetDrawing(!cv.drawing);
    $('cvClear').onclick = () => { const all = cvLines(); delete all[cv.sym]; store.set('npt_cv_lines', all); cvDrawLines(); };
    $('cvMax').onclick = () => cvMaximize(!$('cvCard').classList.contains('cv-max'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('cvCard').classList.contains('cv-max')) cvMaximize(false); if (cv.drawing) cvSetDrawing(false); } });
  }
  function cvSetDrawing(on) { cv.drawing = on; $('cvDraw').classList.toggle('on', on); $('cvDraw').textContent = on ? 'Tap the chart…' : '─ Draw line'; }
  function cvMaximize(on) { $('cvCard').classList.toggle('cv-max', on); document.body.classList.toggle('noscroll', on); $('cvMax').textContent = on ? '✕ Exit full screen' : '⛶ Full screen'; window.dispatchEvent(new Event('resize')); }
  function cvMakeSeries(B) {
    if (!B) return;
    if (cv.main) { cv.chart.removeSeries(cv.main); cv.main = null; }
    const up = '#22c55e', dn = '#ef4444';
    if (cv.type === 'bar') { cv.main = cv.chart.addBarSeries({ upColor: up, downColor: dn }); cv.main.setData(B.d.map((t, i) => ({ time: t, open: B.o[i], high: B.h[i], low: B.l[i], close: B.c[i] }))); }
    else if (cv.type === 'line') { cv.main = cv.chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 }); cv.main.setData(B.d.map((t, i) => ({ time: t, value: B.c[i] }))); }
    else if (cv.type === 'area') { cv.main = cv.chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.3)', bottomColor: 'rgba(59,130,246,0)', lineWidth: 2 }); cv.main.setData(B.d.map((t, i) => ({ time: t, value: B.c[i] }))); }
    else if (cv.type === 'ha') { const h = T.heikin(B); cv.main = cv.chart.addCandlestickSeries(candleOpts); cv.main.setData(B.d.map((t, i) => ({ time: t, open: h.o[i], high: h.h[i], low: h.l[i], close: h.c[i] }))); }
    else { cv.type = 'candle'; cv.main = cv.chart.addCandlestickSeries(candleOpts); cv.main.setData(B.d.map((t, i) => ({ time: t, open: B.o[i], high: B.h[i], low: B.l[i], close: B.c[i] }))); }
    document.querySelectorAll('#cvType button').forEach(b => b.classList.toggle('on', b.dataset.t === cv.type));
    cvDrawLines();
  }
  function cvDrawLines() {
    if (!cv.main) return;
    cv.lineObjs.forEach(l => { try { cv.main.removePriceLine(l); } catch { } }); cv.lineObjs = [];
    (cvLines()[cv.sym] || []).forEach(p => cv.lineObjs.push(cv.main.createPriceLine({ price: p, color: '#f5b544', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' })));
  }
  function cvDrawInds(B) {
    if (!B) return;
    cv.overlays.forEach(x => cv.chart.removeSeries(x)); cv.overlays = [];
    cv.panes.forEach(p => { cv.sync.remove(p.chart); p.ro.disconnect(); p.chart.remove(); }); cv.panes = []; $('cvPanes').innerHTML = '';
    let ci = 0;
    cvInds.forEach(ind => {
      const out = ind.def.calc(B, ind.params);
      if (ind.def.overlay) {
        Object.entries(out).forEach(([k, arr]) => { const x = cv.chart.addLineSeries({ color: COLORS[ci++ % COLORS.length], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineVisible: !ind.def.dots, pointMarkersVisible: !!ind.def.dots, crosshairMarkerVisible: false }); x.setData(line(arr, B)); cv.overlays.push(x); });
      } else {
        const box = el('div', { className: 'pane' }); box.appendChild(el('div', { className: 'lbl', textContent: ind.def.name + (ind.def.params.length ? ' (' + Object.values(ind.params).join(', ') + ')' : '') })); $('cvPanes').appendChild(box);
        const ch = LC.createChart(box, chartOpts(130)); const ro = autoResize(ch, box); let first = null, k2 = 0;
        Object.entries(out).forEach(([k, arr]) => {
          let x; if (ind.def.hist === k) { x = ch.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }); x.setData(line(arr, B).map(p => ({ ...p, color: p.value >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' }))); }
          else { x = ch.addLineSeries({ color: COLORS[k2++ % COLORS.length], lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false }); x.setData(line(arr, B)); }
          first = first || x; });
        (ind.def.levels || []).forEach(lv => first.createPriceLine({ price: lv, color: '#3a4558', lineWidth: 1, lineStyle: 2, axisLabelVisible: false }));
        cv.panes.push({ chart: ch, ro }); cv.sync.add(ch);
      }
    });
    const r = cv.chart.timeScale().getVisibleLogicalRange(); if (r) cv.panes.forEach(p => p.chart.timeScale().setVisibleLogicalRange(r));
    $('cvChips').innerHTML = '';
    cvInds.forEach((ind, i) => { const c = el('span', { className: 'chip', title: 'Click to change settings' }, `${esc(ind.def.name.replace(/\s*\(.*\)/, ''))}${ind.def.params.length ? ' ' + Object.values(ind.params).join(',') : ''} <b title="Remove">✕</b>`);
      c.querySelector('b').onclick = ev => { ev.stopPropagation(); cvInds.splice(i, 1); cvSaveInds(); cvDrawInds(DB[cv.sym]); };
      c.onclick = () => { if (!ind.def.params.length) return; const v = prompt(`${ind.def.name}\nSettings (${ind.def.params.map(p => p.name).join(', ')}):`, Object.values(ind.params).join(',')); if (v === null) return;
        v.split(',').forEach((x, k) => { const p = ind.def.params[k]; if (p && x.trim() !== '' && isFinite(+x)) ind.params[p.name] = +x; }); cvSaveInds(); cvDrawInds(DB[cv.sym]); };
      $('cvChips').appendChild(c); });
  }
  function cvApplyRange() {
    const B = DB[cv.sym]; if (!B) return; document.querySelectorAll('#cvRanges button').forEach(b => b.classList.toggle('on', b.textContent === cv.range));
    if (cv.range === 'All') return cv.chart.timeScale().fitContent();
    const days = { '1M': 31, '3M': 92, '6M': 183, '1Y': 365, '3Y': 1096, '5Y': 1827 }[cv.range] || 365; const to = B.d[B.d.length - 1];
    const from = new Date(new Date(to).getTime() - days * 864e5).toISOString().slice(0, 10);
    try { cv.chart.timeScale().setVisibleRange({ from: from < B.d[0] ? B.d[0] : from, to }); } catch { cv.chart.timeScale().fitContent(); }
  }
  function cvLegend(param) {
    const B = DB[cv.sym]; if (!B) return;
    let i = B.d.length - 1;
    if (param && param.time) { const t = param.time; const key = typeof t === 'string' ? t : typeof t === 'object' ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}` : new Date(t * 1000).toISOString().slice(0, 10); if (cv.idx.has(key)) i = cv.idx.get(key); }
    const ch = i > 0 ? (B.c[i] / B.c[i - 1] - 1) * 100 : 0;
    $('cvLegend').innerHTML = `<b>${esc(cv.sym)}</b> <span class="muted">${B.d[i]}</span> O <b>${fmt(B.o[i])}</b> H <b>${fmt(B.h[i])}</b> L <b>${fmt(B.l[i])}</b> C <b>${fmt(B.c[i])}</b> <span class="${cls(ch)}">${pct(ch)}</span> <span class="muted">Vol ${fmtVol(B.v[i])}</span>`;
  }
  function cvStats(B) {
    const n = B.c.length, last = B.c[n - 1], y = Math.max(0, n - 252);
    let hi52 = -Infinity, lo52 = Infinity; for (let i = y; i < n; i++) { if (B.h[i] > hi52) hi52 = B.h[i]; if (B.l[i] < lo52) lo52 = B.l[i]; }
    let ath = -Infinity, athI = 0; for (let i = 0; i < n; i++) if (B.h[i] > ath) { ath = B.h[i]; athI = i; }
    const r1 = (last / B.c[y] - 1) * 100, yrs = (new Date(B.d[n - 1]) - new Date(B.d[0])) / 31557600000;
    const i5 = n > 1260 ? n - 1260 : -1, cagr5 = i5 >= 0 ? (Math.pow(last / B.c[i5], 1 / 5) - 1) * 100 : NaN;
    let av = 0, k = 0; for (let i = Math.max(0, n - 20); i < n; i++) { av += B.v[i]; k++; } av /= k || 1;
    metricCards($('cvStats'), [
      ['Latest day', fmt(last), dayChg(cv.sym), `O ${fmt(B.o[n - 1])} · H ${fmt(B.h[n - 1])} · L ${fmt(B.l[n - 1])}`],
      ['52-week range', `${fmt(lo52, 0)}–${fmt(hi52, 0)}`, undefined, `${fmt((last / hi52 - 1) * 100, 1)}% from 52W high`],
      ['All-time high', fmt(ath), undefined, `${B.d[athI]} · ${fmt((last / ath - 1) * 100, 1)}% away`],
      ['1-year return', pct(r1, 1), r1, `Since ${B.d[y]}`],
      ['5-year CAGR', isFinite(cagr5) ? pct(cagr5, 1) : '—', isFinite(cagr5) ? cagr5 : undefined, isFinite(cagr5) ? 'per year' : 'less than 5 years of data'],
      ['Avg volume (20D)', fmtVol(av), undefined, `History: ${fmt(yrs, 1)} years from ${B.d[0]}`]]);
  }
  function cvRender() {
    cvInit(); const B = DB[S.sym]; if (!B) return;
    if (cv.sym !== S.sym) {
      cv.sym = S.sym; cv.idx = new Map(B.d.map((d, i) => [d, i]));
      cvMakeSeries(B);
      cv.vol.setData(B.d.map((t, i) => ({ time: t, value: B.v[i], color: B.c[i] >= B.o[i] ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' })));
      cv.vol.applyOptions({ visible: $('cvVol').checked });
      cvDrawInds(B); cvApplyRange(); cvStats(B); cvLegend();
    }
  }
  onTab.chart = cvRender;

  // ═════════ SUPPORT: UPI donations, broker referrals, first-visit notice ═════════
  // Everything here is driven by js/config.js; features with no settings stay hidden.
  const CFG = window.NPT_CONFIG || {};
  function initSupport() {
    const upi = CFG.upi || {}, upiId = String(upi.id || '').trim();
    const hasUpi = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(upiId);
    const brokers = (CFG.brokers || []).filter(b => b && b.name && /^https:\/\//i.test(String(b.url || '').trim()));
    if (!hasUpi && !brokers.length) return;
    $('supportTabBtn').hidden = false; $('footSupport').hidden = false; $('ptReal').hidden = !brokers.length;
    if (hasUpi) {
      $('donateCard').hidden = false; $('upiId').textContent = upiId;
      const payee = String(upi.name || CFG.siteName || 'Nifty Paper Trader').trim();
      let amount = '101';
      const draw = () => {
        // Keep '@' in the UPI ID literal: some UPI apps reject a percent-encoded payee address.
        const enc = encodeURIComponent;
        const link = `upi://pay?pa=${upiId}&pn=${enc(payee)}${amount ? '&am=' + amount : ''}&cu=INR&tn=${enc('Support ' + (CFG.siteName || 'Nifty Paper Trader'))}`;
        const qr = window.qrcode(0, 'M'); qr.addData(link); qr.make();
        $('upiQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'UPI QR code' });
        $('upiApp').href = link;
        document.querySelectorAll('#upiAmts button').forEach(b => b.classList.toggle('on', b.dataset.a === amount));
      };
      $('upiAmts').onclick = e => { const b = e.target.closest('button'); if (!b) return; amount = b.dataset.a; draw(); };
      $('upiCopy').onclick = async () => { try { await navigator.clipboard.writeText(upiId); toast('UPI ID copied'); } catch { prompt('Copy this UPI ID:', upiId); } };
      draw();
    }
    if (brokers.length) {
      $('brokerCard').hidden = false;
      $('brokerList').innerHTML = brokers.map(b => `<a class="broker" href="${esc(String(b.url).trim())}" target="_blank" rel="noopener sponsored"><b>${esc(b.name)}</b><span>Open account →</span></a>`).join('');
    }
  }
  document.addEventListener('click', e => { const a = e.target.closest('[data-goto]'); if (!a) return; e.preventDefault(); const b = document.querySelector(`#tabs button[data-tab="${a.dataset.goto}"]`); if (b && !b.hidden) { b.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  function initNotice() {
    if (CFG.showDisclaimerOnFirstVisit === false || store.get('npt_ack_v1', false)) return;
    $('ackModal').hidden = false; $('ackOk').focus();
    $('ackOk').onclick = () => { store.set('npt_ack_v1', true); $('ackModal').hidden = true; };
  }

  // ═════════ BOOT ═════════
  (async function boot() {
    const here = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/[^\/]*$/, '').replace(/\//g, '\\');
    if (!MAN.length) document.querySelector('main').prepend(el('div', { className: 'banner' }, `<b>No data found.</b> This page is running from <code>${esc(here)}</code>, but there is no <code>data\\manifest.js</code> in that folder.<br>
      Make sure you opened the <code>index.html</code> that sits next to the <code>data</code> folder where you ran <code>python download_data.py</code>, and not a copy inside the zip or a different folder. Or run the downloader in this folder.`));
    else if (!MAN.some(m => m.kind !== 'index')) document.querySelector('main').prepend(el('div', { className: 'banner' }, 'Only sample index data is loaded. Run <code>python download_data.py</code> in this folder to download full history for all Nifty 100 stocks, then reload.'));
    [...new Set(STRATS.map(s => s.cat))].forEach(c => $('libCat').appendChild(el('option', { value: c, textContent: c })));
    $('indList').innerHTML = INDICATORS.map((d, i) => `<div>${i + 1}. ${d.name}${d.overlay ? '' : ' <span class="muted small">(pane)</span>'}</div>`).join('');
    initCharts(); initIndicatorPicker(); showStrat(); renderOpParams(); initSupport(); initNotice();
    $('dataStatus').textContent = 'Loading…';
    const saved = store.get('npt_sym', null); let syms = allSyms();
    if (!syms.length) { await loadImported(); syms = allSyms(); }
    const first = [saved, 'RELIANCE', 'NIFTY50'].find(s => s && syms.includes(s)) || syms[0];
    if (first) await setSymbol(first);
    if (first && !DB[first]) document.querySelector('main').prepend(el('div', { className: 'banner' }, `<b>Data files could not be loaded.</b> <code>data\\manifest.js</code> lists ${MAN.length} instruments, but <code>data\\${esc(manOf(first)?.file || '')}</code> is missing. Run <code>python download_data.py --update</code> in <code>${esc(here)}</code>.`));
    loadEverything();   // the rest of the data streams in the background
  })();
})();
