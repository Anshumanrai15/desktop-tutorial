// Reality check: an honest second look at every backtest. Answers four questions:
//   1. Does the strategy beat simply buying the stock, after real Indian charges and tax?
//   2. Does it beat the Nifty 50?
//   3. Does it still work on the last 30% of the data (the part a tuned strategy hasn't "seen")?
//   4. Does it work on other stocks too, or was this one lucky? (on request, it needs all data)
(function () {
  const P = window.PP; if (!P) return;
  const { $, esc, fmt, inr, pct, cls, DB, ensure, loadEverything, stockSyms, settings, getResult, BT, byId, debounce } = Object.assign({ BT: window.BT }, P);

  // ── Indian delivery charges (equity cash, per order) ──
  // Brokerage: ₹20 or 0.1%, whichever is lower (many brokers charge ₹0 for delivery).
  // STT 0.1% on buy and sell · NSE fee 0.00297% · SEBI fee ₹10/crore · stamp duty 0.015% on buy
  // GST 18% on brokerage + exchange + SEBI fees · DP charge ₹15.93 per sell.
  function orderCharges(value, side) {
    const brok = Math.min(20, value * 0.001), exch = value * 0.0000297, sebi = value * 0.000001;
    const stt = value * 0.001, stamp = side === 'buy' ? value * 0.00015 : 0, gst = 0.18 * (brok + exch + sebi), dp = side === 'sell' ? 15.93 : 0;
    return brok + exch + sebi + stt + stamp + gst + dp;
  }
  // Indian financial year of a date (April to March), e.g. 2024-05-10 -> 2024.
  const fy = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m >= 4 ? y : y - 1; };
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;

  // Today's capital-gains rules on listed shares: short-term (held 12 months or less) 20%,
  // long-term 12.5% above ₹1.25 lakh a year, plus 4% cess. Losses set off and carry forward 8 years.
  function taxOn(gains) {   // gains: [{date, gain, longTerm}]
    const byFy = new Map(); gains.forEach(g => { const k = fy(g.date); const r = byFy.get(k) || { st: 0, lt: 0 }; if (g.longTerm) r.lt += g.gain; else r.st += g.gain; byFy.set(k, r); });
    let cfSt = 0, cfLt = 0, total = 0;   // carried-forward losses (positive numbers)
    [...byFy.keys()].sort((a, b) => a - b).forEach(k => {
      let { st, lt } = byFy.get(k);
      if (st < 0) { lt += st; st = 0; }                       // short-term loss can offset long-term gains
      if (lt < 0) { cfLt += -lt; lt = 0; }                    // simplification: leftover long-term loss carried
      let use = Math.min(cfSt, st); st -= use; cfSt -= use;    // old short-term losses offset either
      use = Math.min(cfSt, lt); lt -= use; cfSt -= use;
      use = Math.min(cfLt, lt); lt -= use; cfLt -= use;        // old long-term losses offset long-term only
      const t = 0.20 * st + 0.125 * Math.max(0, lt - 125000);
      total += t * 1.04;
    });
    return total;
  }

  // ── strategy after real charges and tax ──
  function afterCostsAndTax(r, costPct) {
    const cost = costPct / 100; let engine = 0, real = 0; const gains = [];
    r.trades.forEach(t => {
      const v1 = t.qty * t.entryPx, v2 = t.qty * t.exitPx;
      engine += (v1 + v2) * cost;
      const ch = orderCharges(v1, t.side === 1 ? 'buy' : 'sell') + orderCharges(v2, t.side === 1 ? 'sell' : 'buy');
      real += ch;
      const gross = t.side * t.qty * (t.exitPx - t.entryPx);
      gains.push({ date: t.exitDate, gain: gross - ch, longTerm: days(t.entryDate, t.exitDate) > 365 });
    });
    const final = r.metrics.finalEquity, afterCharges = final + engine - real, tax = taxOn(gains);
    return { engine, real, tax, afterCharges, afterTax: afterCharges - tax };
  }
  function buyHoldAfterTax(cap, p0, p1, d0, d1) {
    const buy = orderCharges(cap, 'buy'), qty = (cap - buy) / p0, sellV = qty * p1, sell = orderCharges(sellV, 'sell');
    const gain = sellV - sell - cap, tax = taxOn([{ date: d1, gain, longTerm: days(d0, d1) > 365 }]);
    return cap + gain - tax;
  }
  const cagrOf = (v0, v1, d0, d1) => { const y = Math.max(days(d0, d1) / 365.25, 1 / 365); return (Math.pow(Math.max(v1, 1) / v0, 1 / y) - 1) * 100; };
  const idxOnOrAfter = (arr, d) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < d) lo = m + 1; else hi = m; } return lo; };
  const idxOnOrBefore = (arr, d) => { const i = idxOnOrAfter(arr, d); return arr[i] === d ? i : i - 1; };
  const yr = d => d.slice(0, 4);
  const tick = ok => ok === null ? '<span class="rc-i na">–</span>' : ok ? '<span class="rc-i ok">✓</span>' : '<span class="rc-i no">✗</span>';

  let luck = null;   // last "other stocks" result: {key, beat, n, median, rank}
  const luckKey = R => [R.s.id, JSON.stringify(R.params), JSON.stringify(settings())].join('|');

  async function render() {
    const R = getResult(); if (!R || !R.r.dates.length) { $('rcCard').hidden = true; return; }
    const { r, s, sym, params } = R, B = DB[sym], o = settings(), m = r.metrics, n = r.dates.length;
    if (!B || n < 30) { $('rcCard').hidden = true; return; }
    const d0 = r.dates[0], d1 = r.dates[n - 1], [a, b] = r.range, cap = o.capital;
    const rows = [], checks = {};

    // 1) charges + tax, against buying and holding this stock
    const ct = afterCostsAndTax(r, o.costPct);
    const bh = buyHoldAfterTax(cap, B.c[a], B.c[b], d0, d1);
    const sC = cagrOf(cap, ct.afterTax, d0, d1), bC = cagrOf(cap, bh, d0, d1);
    checks.beatBH = r.trades.length ? ct.afterTax > bh : null;
    rows.push(`<tr><td class="l">${tick(checks.beatBH)} <b>This strategy</b>, after real charges and tax</td><td>${inr(ct.afterTax)}</td><td class="${cls(sC)}">${pct(sC, 1)}</td></tr>`);
    rows.push(`<tr><td class="l"><span class="rc-i na">·</span> Just buy ${esc(sym)} and hold, after tax</td><td>${inr(bh)}</td><td class="${cls(bC)}">${pct(bC, 1)}</td></tr>`);

    // 2) against the Nifty 50 (an index fund), over the dates both have
    let niftyLine = '';
    if (sym !== 'NIFTY50') {
      const N = DB.NIFTY50;   // loaded only once the card is on screen, so the first page load stays light
      if (!N) niftyLine = '<p class="small muted">Comparing with the Nifty 50…</p>';
      else if (N.d.length) {
        const from = d0 > N.d[0] ? d0 : N.d[0]; const k = idxOnOrAfter(r.dates, from), na = idxOnOrAfter(N.d, r.dates[k]), nb = idxOnOrBefore(N.d, d1);
        if (k < n - 20 && nb > na) {
          const sameDates = k === 0;
          const nVal = buyHoldAfterTax(cap, N.c[na], N.c[nb], N.d[na], N.d[nb]), nC = cagrOf(cap, nVal, N.d[na], N.d[nb]);
          if (sameDates) {
            checks.beatNifty = r.trades.length ? ct.afterTax > nVal : null;
            rows.push(`<tr><td class="l">${tick(checks.beatNifty)} Nifty 50 index fund, after tax</td><td>${inr(nVal)}</td><td class="${cls(nC)}">${pct(nC, 1)}</td></tr>`);
          } else {
            const sPart = cagrOf(r.equity[k], r.equity[n - 1], r.dates[k], d1), nPart = cagrOf(N.c[na], N.c[nb], N.d[na], N.d[nb]);
            checks.beatNifty = r.trades.length ? sPart > nPart : null;
            niftyLine = `<p class="small">${tick(checks.beatNifty)} <b>Against the Nifty 50</b> (its data starts ${esc(N.d[0])}): since ${esc(r.dates[k])} the strategy made <b class="${cls(sPart)}">${pct(sPart, 1)}</b> a year before tax, and the Nifty made <b class="${cls(nPart)}">${pct(nPart, 1)}</b>.</p>`;
          }
        }
      }
    }
    const chargeNote = r.trades.length
      ? `<p class="muted small">Real Indian charges on ${fmt(r.trades.length, 0)} trades: about <b>${inr(ct.real)}</b> (the backtest used ${inr(ct.engine)}). Estimated capital-gains tax at today's rates: <b>${inr(ct.tax)}</b>. Rough figures: they leave out the growth lost on money paid out along the way.</p>`
      : '<p class="muted small">This strategy made no trades in the tested period.</p>';

    // 3) the last 30% of the data, tested on its own
    let unseen = '';
    const split = r.dates[Math.floor(n * 0.7)];
    if (r.trades.length && n >= 250) {
      const pos = BT.strategyPositions(s, B, params);
      const early = BT.run(B, pos, { ...o, start: d0, end: r.dates[Math.floor(n * 0.7) - 1] }).metrics;
      const late = BT.run(B, pos, { ...o, start: split, end: d1 }).metrics;
      const eA = early.cagr - early.bhCagr, lA = late.cagr - late.bhCagr;
      checks.unseen = late.trades ? lA > 0 : null;
      const tuned = Object.keys(s.params).some(k => params[k] !== s.params[k]);
      unseen = `<div class="rc-split">
        <div><div class="muted small">First 70% · ${yr(d0)}–${yr(split)}</div><b class="${cls(eA)}">${pct(eA, 1)}</b> <span class="muted small">a year vs buy &amp; hold</span></div>
        <div><div class="muted small">Last 30% · ${yr(split)}–${yr(d1)}</div><b class="${cls(lA)}">${pct(lA, 1)}</b> <span class="muted small">a year vs buy &amp; hold</span></div></div>
        <p class="small">${tick(checks.unseen)} ${late.trades === 0 ? 'No trades in the last 30%, so it can’t be judged there.' : lA > 0 && eA > 0 ? 'It beat buy &amp; hold in both parts. A good sign, though still past data.' : lA > 0 ? 'It only beat buy &amp; hold in the recent part.' : eA > 0 ? '<b>It worked early on but not recently.</b> Edges often fade once they become well known.' : 'It lagged buy &amp; hold in both parts.'}
        ${tuned ? `<span class="muted">You changed the strategy's settings. If you picked them with the Optimizer, only a test on data the Optimizer didn't use is fair: set <b>To</b> = ${esc(split)} in Settings, optimise, then clear it and look at the last-30% number here.</span>` : ''}</p>`;
    }

    // 4) other stocks (on request)
    const key = luckKey(R);
    const luckHTML = luck && luck.key === key
      ? (() => { checks.luck = luck.n ? luck.beat / luck.n >= 0.5 : null; return `<p class="small">${tick(checks.luck)} <b>On other stocks:</b> beat buy &amp; hold on <b>${luck.beat} of ${luck.n}</b> stocks (median ${pct(luck.median, 1)} a year).${luck.rank ? ` ${esc(sym)} ranks #${luck.rank}.` : ''} ${luck.beat / luck.n < 0.5 ? 'Most stocks did better with plain buy &amp; hold, so this result may be luck.' : ''}</p>`; })()
      : `<p class="small"><button id="rcLuck" class="ghost">Test this on all ${stockSyms().length} stocks</button> <span class="muted">Was ${esc(sym)} just lucky?</span> <span id="rcLuckSt" class="muted"></span></p>`;

    // drawdown + sample size warnings
    const warns = [];
    if (m.maxDD < -35) warns.push(`At its worst this strategy was down <b>${fmt(-m.maxDD, 0)}%</b>, so ${inr(cap)} would have shrunk to about <b>${inr(cap * (1 + m.maxDD / 100))}</b>. Would you have kept following it?`);
    if (r.trades.length > 0 && r.trades.length < 15) warns.push(`Only ${r.trades.length} trades. That's too few to tell skill from luck.`);
    if (!o.longOnly && r.trades.some(t => t.side === -1)) warns.push('Short trades can’t be held overnight in the Indian cash market; you’d need futures, which cost more.');

    // verdict
    const vals = Object.values(checks).filter(v => v !== null), fails = vals.filter(v => !v).length;
    let verdict, vc;
    if (!r.trades.length) { verdict = 'No trades'; vc = 'na'; }
    else if (checks.beatBH === false && (checks.beatNifty === false || checks.beatNifty === undefined)) { verdict = 'Buying and holding did better'; vc = 'no'; }
    else if (fails === 0 && r.trades.length >= 15) { verdict = 'Holds up so far'; vc = 'ok'; }
    else if (fails <= 1) { verdict = 'Mixed: treat with caution'; vc = 'mid'; }
    else { verdict = 'Probably luck'; vc = 'no'; }
    $('rcVerdict').className = 'rc-verdict ' + vc; $('rcVerdict').textContent = verdict;

    $('rcBody').innerHTML = `
      <div class="tablewrap"><table class="rc-table"><tr><th class="l">Starting with ${inr(cap)} · ${esc(d0)} → ${esc(d1)}</th><th>You'd have</th><th>Per year</th></tr>${rows.join('')}</table></div>
      ${niftyLine}${chargeNote}${unseen}${luckHTML}
      ${warns.map(w => `<p class="small rc-warn">⚠ ${w}</p>`).join('')}
      <p class="muted small rc-surv"><b>Survivor bias:</b> these are today's Nifty 100 companies, the ones that made it. Stocks that collapsed and left the index (like Yes Bank or DHFL) aren't here, so most backtests on this site look better than real life. Educational only, not advice.</p>`;
    $('rcCard').hidden = false;
    const btn = $('rcLuck'); if (btn) btn.onclick = () => runLuck(R);
  }

  async function runLuck(R) {
    const btn = $('rcLuck'); btn.disabled = true; $('rcLuckSt').textContent = 'Loading all stocks…';
    await loadEverything();
    const o = settings(), key = luckKey(R), syms = stockSyms(), res = [];
    for (let i = 0; i < syms.length; i++) {
      const B = DB[syms[i]]; if (!B) continue;
      try { const r = BT.run(B, BT.strategyPositions(R.s, B, R.params), o); if (r.dates.length > 250 && r.trades.length) res.push({ sym: syms[i], alpha: r.metrics.cagr - r.metrics.bhCagr }); } catch { }
      if (i % 8 === 7) { const st = $('rcLuckSt'); if (st) st.textContent = `Testing ${i + 1} / ${syms.length}…`; await P.sleep(0); }
    }
    if (getResult() !== R) return;
    res.sort((x, y) => y.alpha - x.alpha);
    const med = res.length ? res[Math.floor(res.length / 2)].alpha : 0, rank = res.findIndex(x => x.sym === R.sym) + 1;
    luck = { key, beat: res.filter(x => x.alpha > 0).length, n: res.length, median: med, rank };
    render();
  }

  // Fetch the Nifty 50 history the first time the card scrolls into view.
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !DB.NIFTY50) ensure('NIFTY50').then(() => later()); }).observe($('rcCard'));
  else ensure('NIFTY50');
  const later = debounce(() => { if (P.activeTab() === 'backtest') render(); }, 300);
  window.addEventListener('pp:backtest', later);
  const origTab = P.onTab.backtest; P.onTab.backtest = () => { origTab && origTab(); later(); };
  if (getResult()) later();
})();
