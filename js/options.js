// Options Lab: backtests classic Nifty 50 option strategies since 2008, cycle after cycle.
// Option prices are estimates: Black-Scholes with India VIX as the volatility of every strike.
(function () {
  const P = window.PP; if (!P) return;
  const { $, esc, fmt, inr, pct, cls, toast, DB, ensure, chartOpts, autoResize, compactINR, metricCards, debounce } = P;
  const LC = window.LightweightCharts;
  const R = 0.065, STEP = 50, SLIP = 0.5;   // interest rate, strike interval, slippage per option unit

  // Legs: t = 'C' call, 'P' put, 'U' the index itself (like a future); q = +1 buy, -1 sell;
  // k(d, w) = strike as a multiple of the Nifty level, from strike distance d and wing width w.
  const STRATS = [
    { id: 'short_straddle', name: 'Short straddle', d: 0, w: 0, uses: '', legs: [['C', -1, () => 1], ['P', -1, () => 1]],
      desc: 'Sell a call and a put at the current Nifty level. Earns the premium if Nifty stays still; loses heavily on a big move either way.' },
    { id: 'short_strangle', name: 'Short strangle', d: 3, w: 0, uses: 'd', legs: [['C', -1, d => 1 + d], ['P', -1, d => 1 - d]],
      desc: 'Sell a call above and a put below the current level. Wins often while Nifty stays in a range; one sharp move can wipe out months of gains.' },
    { id: 'iron_condor', name: 'Iron condor', d: 3, w: 2, uses: 'dw', legs: [['C', -1, d => 1 + d], ['C', 1, (d, w) => 1 + d + w], ['P', -1, d => 1 - d], ['P', 1, (d, w) => 1 - d - w]],
      desc: 'A short strangle with protection bought further out. Smaller profits, but the loss in a crash is capped.' },
    { id: 'short_put', name: 'Short put (cash-secured)', d: 3, w: 0, uses: 'd', legs: [['P', -1, d => 1 - d]],
      desc: 'Sell a put below the market: you are paid to agree to buy lower. Behaves like owning Nifty, with the upside capped at the premium.' },
    { id: 'covered_call', name: 'Covered call', d: 3, w: 0, uses: 'd', legs: [['U', 1], ['C', -1, d => 1 + d]],
      desc: 'Own Nifty and sell a call above the market each cycle. Extra income in flat markets; gives up big rallies.' },
    { id: 'protective_put', name: 'Protective put', d: 3, w: 0, uses: 'd', legs: [['U', 1], ['P', 1, d => 1 - d]],
      desc: 'Own Nifty and buy a put below the market as insurance. Losses are limited, but the insurance costs money every cycle.' },
    { id: 'long_straddle', name: 'Long straddle', d: 0, w: 0, uses: '', legs: [['C', 1, () => 1], ['P', 1, () => 1]],
      desc: 'Buy a call and a put at the current level. Profits only from a big move; time decay costs you every quiet day.' },
    { id: 'long_strangle', name: 'Long strangle', d: 3, w: 0, uses: 'd', legs: [['C', 1, d => 1 + d], ['P', 1, d => 1 - d]],
      desc: 'Buy a call above and a put below the market. Cheaper than a straddle, but needs an even bigger move.' },
    { id: 'buy_call', name: 'Buy call', d: 0, w: 0, uses: 'd', legs: [['C', 1, d => 1 + d]],
      desc: 'Buy a call each cycle (strike distance 0 = at the money). The most popular trade among beginners: you need Nifty to rise fast enough to beat time decay.' },
    { id: 'buy_put', name: 'Buy put', d: 0, w: 0, uses: 'd', legs: [['P', 1, d => 1 - d]],
      desc: 'Buy a put each cycle. Pays off in falls, loses the premium in most other months.' },
    { id: 'bull_call_spread', name: 'Bull call spread', d: 0, w: 2, uses: 'dw', legs: [['C', 1, d => 1 + d], ['C', -1, (d, w) => 1 + d + w]],
      desc: 'Buy a call and sell a higher one. Cheaper than buying a call alone, with both profit and loss capped.' },
    { id: 'bear_put_spread', name: 'Bear put spread', d: 0, w: 2, uses: 'dw', legs: [['P', 1, d => 1 - d], ['P', -1, (d, w) => 1 - d - w]],
      desc: 'Buy a put and sell a lower one. A cheaper, capped bet on a fall.' },
  ];
  const byId = Object.fromEntries(STRATS.map(s => [s.id, s]));
  $('opxStrat').innerHTML = STRATS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

  // ── Black-Scholes ──
  const ncdf = x => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), dd = 0.3989423 * Math.exp(-x * x / 2);
    const p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
  function bs(type, S, K, T, iv) {
    if (T <= 1e-9 || iv <= 0) return Math.max(0, type === 'C' ? S - K : K - S);
    const sq = iv * Math.sqrt(T), d1 = (Math.log(S / K) + (R + iv * iv / 2) * T) / sq, d2 = d1 - sq, df = Math.exp(-R * T);
    return type === 'C' ? S * ncdf(d1) - K * df * ncdf(d2) : K * df * ncdf(-d2) - S * ncdf(-d1);
  }
  const strike = (S, m) => Math.round(S * m / STEP) * STEP;

  // Charges for one order on one leg, in ₹ for `units` units at price p.
  function orderCost(t, side, p, units) {
    const v = p * units, brok = 20;
    if (t === 'U') { const exch = v * 0.0000173, stt = side < 0 ? v * 0.0002 : 0, stamp = side > 0 ? v * 0.00002 : 0; return brok + exch + stt + stamp + 0.18 * (brok + exch); }
    const exch = v * 0.0003503, stt = side < 0 ? v * 0.001 : 0, stamp = side > 0 ? v * 0.00003 : 0, sebi = v * 0.000001;
    return brok + exch + stt + stamp + sebi + 0.18 * (brok + exch + sebi);
  }

  function inputs() {
    const s = byId[$('opxStrat').value];
    return { s, H: +$('opxCycle').value, d: Math.max(0, +$('opxDist').value || 0) / 100, w: Math.max(0.5, +$('opxWing').value || 2) / 100,
      stop: Math.max(0, +$('opxStop').value || 0), lot: Math.max(1, Math.floor(+$('opxLot').value || 75)), cap: Math.max(1000, +$('opxCap').value || 300000), from: $('opxFrom').value || '2008-03-03' };
  }
  const legsAt = (s, S, d, w) => s.legs.map(([t, q, k]) => ({ t, q, K: t === 'U' ? 0 : strike(S, k(d, w)) }));
  const legValue = (L, S, T, iv, S0) => (L.t === 'U' ? S - S0 : bs(L.t, S, L.K, T, iv));

  function simulate(N, V, o) {
    const { s, H, d, w, stop, lot, cap } = o, n = N.c.length, Snow = N.c[n - 1];
    let i = 0; while (i < n && (N.d[i] < o.from || !(V[i] > 0))) i++;
    const cycles = [], eq = []; let realized = 0, charges = 0;
    while (i + H <= n - 1) {
      const j = i + H, S0 = N.c[i], iv0 = V[i] / 100, T0 = H / 252, scale = Snow / S0, units = lot * scale;
      const legs = legsAt(s, S0, d, w).map(L => ({ ...L, p0: legValue(L, S0, T0, iv0, S0) }));
      const opt = legs.filter(L => L.t !== 'U'), basis = Math.abs(opt.reduce((a, L) => a + L.q * L.p0, 0)) || 1;
      let cost = 0; legs.forEach(L => { cost += orderCost(L.t, L.q, L.t === 'U' ? S0 : L.p0, units) + (L.t === 'U' ? 0 : SLIP * units); });
      let exitK = j, stopped = false, pnlUnit = 0;
      for (let k = i + 1; k <= j; k++) {
        const T = (j - k) / 252, iv = V[k] / 100;
        pnlUnit = legs.reduce((a, L) => a + L.q * (legValue(L, N.c[k], T, iv, S0) - (L.t === 'U' ? 0 : L.p0)), 0);
        if (k < j && stop > 0 && pnlUnit <= -stop * basis) { exitK = k; stopped = true; }
        eq.push({ time: N.d[k], value: cap + realized + pnlUnit * units - cost });
        if (stopped) break;
      }
      if (stopped) legs.forEach(L => { const px = L.t === 'U' ? N.c[exitK] : legValue(L, N.c[exitK], (j - exitK) / 252, V[exitK] / 100, S0); cost += orderCost(L.t, -L.q, px, units) + (L.t === 'U' ? 0 : SLIP * units); });
      else legs.forEach(L => { if (L.t === 'U') cost += orderCost('U', -1, N.c[j], units); else if (L.q > 0) cost += 0.00125 * Math.max(0, L.t === 'C' ? N.c[j] - L.K : L.K - N.c[j]) * units; });   // STT on exercised options
      const pnl = pnlUnit * units - cost; realized += pnl; charges += cost;
      if (eq.length) eq[eq.length - 1].value = cap + realized;
      cycles.push({ d0: N.d[i], d1: N.d[exitK], S0, S1: N.c[exitK], vix: V[i], pnl, stopped, credit: -opt.reduce((a, L) => a + L.q * L.p0, 0) });
      // During a stopped cycle, wait (flat) until the planned expiry before opening the next one.
      for (let k = exitK + 1; k <= j; k++) eq.push({ time: N.d[k], value: cap + realized });
      i = j;
    }
    return { cycles, eq, realized, charges };
  }

  // ── payoff diagram (today's prices, at expiry) ──
  function payoff(o, S, vix) {
    const T = o.H / 252, iv = vix / 100, legs = legsAt(o.s, S, o.d, o.w).map(L => ({ ...L, p0: legValue(L, S, T, iv, S) }));
    const span = Math.max(0.06, 2.5 * iv * Math.sqrt(T)), lo = S * (1 - span), hi = S * (1 + span), pts = [];
    for (let k = 0; k <= 120; k++) { const x = lo + (hi - lo) * k / 120; pts.push([x, legs.reduce((a, L) => a + L.q * (L.t === 'U' ? x - S : Math.max(0, L.t === 'C' ? x - L.K : L.K - x) - L.p0), 0) * o.lot]); }
    const ys = pts.map(p => p[1]), ymin = Math.min(0, ...ys), ymax = Math.max(0, ...ys), W = 320, Hh = 180, pad = 6;
    const X = x => pad + (x - lo) / (hi - lo) * (W - 2 * pad), Y = y => pad + (ymax - y) / ((ymax - ymin) || 1) * (Hh - 2 * pad);
    const path = pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const z = Y(0), area = sign => `<clipPath id="cl${sign}"><rect x="0" y="${sign > 0 ? 0 : z}" width="${W}" height="${sign > 0 ? z : Hh - z}"/></clipPath><path d="${path} L${X(hi)} ${z} L${X(lo)} ${z} Z" fill="${sign > 0 ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}" clip-path="url(#cl${sign})"/>`;
    const be = []; for (let k = 1; k < pts.length; k++) if ((pts[k - 1][1] < 0) !== (pts[k][1] < 0)) be.push(pts[k][0]);
    const edgeUp = ys[ys.length - 1] - ys[ys.length - 2], edgeDn = ys[0] - ys[1];
    const unl = v => (Math.abs(v) > 1e-6);   // still sloping at the edge of the chart: unlimited
    const maxP = Math.max(...ys), maxL = Math.min(...ys);
    $('opxPayoff').innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" class="opx-svg" role="img" aria-label="Profit or loss at expiry">${area(1)}${area(-1)}
      <line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="#3a4558"/><line x1="${X(S)}" x2="${X(S)}" y1="0" y2="${Hh}" stroke="#f5b544" stroke-dasharray="3 3"/>
      <path d="${path}" fill="none" stroke="#3b82f6" stroke-width="2"/></svg>
      <div class="opx-axis small muted"><span>${fmt(lo, 0)}</span><span style="color:#f5b544">Nifty now ${fmt(S, 0)}</span><span>${fmt(hi, 0)}</span></div>`;
    const credit = legs.filter(L => L.t !== 'U').reduce((a, L) => a - L.q * L.p0, 0) * o.lot;
    $('opxLegs').innerHTML = `<p class="muted">Estimated today, ${o.H === 5 ? 'weekly' : 'monthly'} expiry, 1 lot of ${o.lot}, India VIX ${fmt(vix, 1)}:</p><ul class="opx-leglist">` +
      legs.map(L => `<li><b class="${L.q > 0 ? 'pos' : 'neg'}">${L.q > 0 ? 'Buy' : 'Sell'}</b> ${L.t === 'U' ? 'Nifty (future or ETF)' : `${fmt(L.K, 0)} ${L.t === 'C' ? 'call' : 'put'} at about ₹${fmt(L.p0, 1)}`}</li>`).join('') + '</ul>' +
      `<p>${credit >= 0 ? 'You collect' : 'You pay'} about <b>${inr(Math.abs(credit))}</b>. Max profit: <b>${unl(edgeUp) && edgeUp > 0 || unl(edgeDn) && edgeDn > 0 ? 'unlimited' : inr(maxP)}</b> · Max loss: <b class="neg">${unl(edgeUp) && edgeUp < 0 || unl(edgeDn) && edgeDn < 0 ? 'unlimited' : inr(-maxL)}</b>${be.length ? ` · Break-even at ${be.map(x => fmt(x, 0)).join(' and ')}` : ''}</p>`;
  }

  // Rough money needed today to run one lot: the full value when the strategy owns Nifty, about 13%
  // of the value as margin for unprotected sold options, the wing width for spreads, and five cycles
  // of premium for pure option buyers.
  function capitalNeeded(o, S, vix) {
    const T = o.H / 252, legs = legsAt(o.s, S, o.d, o.w).map(L => ({ ...L, p0: legValue(L, S, T, vix / 100, S) })), val = S * o.lot;
    const cnt = (t, q) => legs.filter(L => L.t === t && L.q === q).length, own = legs.some(L => L.t === 'U');
    const premPaid = legs.filter(L => L.t !== 'U' && L.q > 0).reduce((a, L) => a + L.p0, 0) * o.lot;
    let need;
    if (own) need = val + premPaid;
    else if (cnt('C', -1) > cnt('C', 1) || cnt('P', -1) > cnt('P', 1)) need = 0.13 * val;
    else if (cnt('C', -1) || cnt('P', -1)) need = o.w * val;
    else need = 5 * premPaid;
    return Math.max(10000, Math.ceil(need / 10000) * 10000);
  }
  let capAuto = true;   // capital follows the strategy until the user types their own amount
  $('opxCap').addEventListener('input', () => { capAuto = false; });

  let chart, series;
  async function run() {
    const o = inputs();
    $('opxDesc').textContent = o.s.desc;
    $('opxDist').closest('label').style.opacity = o.s.uses.includes('d') ? 1 : 0.4; $('opxDist').disabled = !o.s.uses.includes('d');
    $('opxWing').closest('label').style.opacity = o.s.uses.includes('w') ? 1 : 0.4; $('opxWing').disabled = !o.s.uses.includes('w');
    const [N, VX] = await Promise.all([ensure('NIFTY50'), ensure('INDIAVIX')]);
    if (!N || !VX) { $('opxLesson').innerHTML = '<p>Nifty 50 and India VIX data are needed for the Options Lab.</p>'; return; }
    const vm = new Map(VX.d.map((d, k) => [d, VX.c[k]])); let last = NaN; const V = N.d.map(d => { const v = vm.get(d); if (v > 0) last = v; return last; });
    const need = capitalNeeded(o, N.c[N.c.length - 1], V[V.length - 1]);
    if (capAuto) { o.cap = need; $('opxCap').value = need; }
    $('opxDesc').textContent = `${o.s.desc} Money needed for 1 lot today: about ${inr(need)}${o.s.legs.some(L => L[0] === 'U') ? ' (you own the Nifty itself)' : ''}.`;
    const r = simulate(N, V, o), c = r.cycles;
    if (!chart) { chart = LC.createChart($('opxEquity'), { ...chartOpts(260), localization: { priceFormatter: compactINR } }); autoResize(chart, $('opxEquity'));
      series = chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0)', lineWidth: 2, priceLineVisible: false }); }
    series.setData(r.eq); chart.timeScale().fitContent();
    payoff(o, N.c[N.c.length - 1], V[V.length - 1]);
    if (!c.length) { metricCards($('opxHead'), []); $('opxLesson').innerHTML = '<p>Not enough data after the chosen start date.</p>'; return; }
    const wins = c.filter(x => x.pnl > 0), losses = c.filter(x => x.pnl <= 0), avgW = wins.length ? wins.reduce((a, x) => a + x.pnl, 0) / wins.length : 0, avgL = losses.length ? losses.reduce((a, x) => a + x.pnl, 0) / losses.length : 0;
    const worst = c.reduce((a, x) => (x.pnl < a.pnl ? x : a), c[0]);
    let pk = -Infinity, mdd = 0; r.eq.forEach(p => { pk = Math.max(pk, p.value); mdd = Math.min(mdd, p.value - pk); });
    const years = (new Date(c[c.length - 1].d1) - new Date(c[0].d0)) / 31557600000, perYr = r.realized / o.cap / years * 100;
    const ni0 = N.d.indexOf(c[0].d0), ni1 = N.d.indexOf(c[c.length - 1].d1), niftyCagr = (Math.pow(N.c[ni1] / N.c[ni0], 1 / years) - 1) * 100;
    metricCards($('opxHead'), [
      ['Total profit', inr(r.realized), r.realized, `${fmt(c.length, 0)} cycles since ${c[0].d0}`],
      ['Per year', pct(perYr, 1), perYr, `on ${inr(o.cap)} · Nifty itself ${pct(niftyCagr, 1)}`],
      ['Win rate', fmt(wins.length / c.length * 100, 0) + '%', undefined, `Avg win ${inr(avgW)} · avg loss ${inr(avgL)}`],
      ['Worst cycle', inr(worst.pnl), worst.pnl, `${worst.d0} · Nifty ${pct((worst.S1 / worst.S0 - 1) * 100, 1)}`],
      ['Max drawdown', inr(mdd), mdd, -mdd >= o.cap ? 'more than all your capital' : `${fmt(mdd / o.cap * 100, 0)}% of capital`],
      ['Charges paid', inr(r.charges), undefined, `${inr(r.charges / c.length)} per cycle`]]);
    $('opxEqNote').textContent = `Starts at ${inr(o.cap)}; 1 lot each cycle, sized to today's Nifty`;
    const seller = c.filter(x => x.credit > 0).length > c.length / 2;   // collects premium at the start of most cycles
    const ratio = avgW > 0 ? -worst.pnl / avgW : 0;
    const lesson = seller
      ? `<p><b>This strategy won ${fmt(wins.length / c.length * 100, 0)}% of the time.</b> That feels great, until a cycle like ${esc(worst.d0)}, when Nifty moved ${pct((worst.S1 / worst.S0 - 1) * 100, 1)} and one cycle lost <b class="neg">${inr(-worst.pnl)}</b>${ratio >= 1.5 ? `, as much as <b>${fmt(ratio, 0)} average wins</b>` : ''}. Selling options means many small wins and a few large losses.</p>`
      : `<p><b>This strategy lost money in ${fmt(losses.length / c.length * 100, 0)}% of cycles.</b> Option buyers pay for time: an option loses value every day that the market doesn't move enough. ${wins.length ? `The wins (average ${inr(avgW)}) have to make up for all the small losses.` : ''}</p>`;
    const ruin = r.eq.find(p => p.value <= 0);
    const ruinHTML = ruin ? `<p class="rc-warn">💥 With ${inr(o.cap)} you would have been <b>wiped out on ${esc(ruin.time)}</b>. The profit above assumes you kept trading anyway; in real life your broker would have closed your positions with a margin call even sooner.</p>` : '';
    $('opxLesson').innerHTML = ruinHTML + lesson + `<p class="small">${r.realized > 0 && perYr > niftyCagr ? 'It beat the Nifty here on paper, but these prices are estimates. Real crashes push option prices far above what this model assumes, which hurts sellers most.' : r.realized > 0 ? `It made money, but less than simply holding the Nifty (${pct(niftyCagr, 1)} a year), with far more risk and effort.` : 'Overall it lost money after charges.'}</p>
      <p class="small rc-warn">SEBI found that <b>93% of individual F&amp;O traders lost money</b> between FY22 and FY24. Try different strategies here to see why. Estimates only, not advice.</p>`;
    $('opxWorst').innerHTML = '<tr><th class="l">Opened</th><th class="l">Closed</th><th>Nifty move</th><th>VIX</th><th>P&amp;L ₹</th><th class="l"></th></tr>' +
      c.slice().sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(x => `<tr><td class="l">${x.d0}</td><td class="l">${x.d1}</td><td class="${cls(x.S1 - x.S0)}">${pct((x.S1 / x.S0 - 1) * 100, 1)}</td><td>${fmt(x.vix, 1)}</td><td class="${cls(x.pnl)}">${fmt(x.pnl, 0)}</td><td class="l muted small">${x.stopped ? 'stop-loss' : ''}</td></tr>`).join('');
  }
  const rerun = debounce(() => run(), 200);
  $('opxStrat').onchange = () => { const s = byId[$('opxStrat').value]; $('opxDist').value = s.d; $('opxWing').value = s.w || 2; run(); };
  ['opxCycle', 'opxDist', 'opxWing', 'opxStop', 'opxLot', 'opxCap', 'opxFrom'].forEach(id => $(id).addEventListener('input', rerun));
  $('opxShare').onclick = async () => {
    const url = location.origin + location.pathname + '#options', text = 'Backtest Nifty option strategies since 2008 on PaperPaisaa (free, educational)';
    try { if (navigator.share) { await navigator.share({ title: 'PaperPaisaa Options Lab', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it anywhere to share.'); } catch { prompt('Copy this link:', url); }
  };
  let started = false;
  P.onTab.options = () => { if (!started) { started = true; $('opxStrat').onchange(); } };
})();
