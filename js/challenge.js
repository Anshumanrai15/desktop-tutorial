// Crash Challenge ("Would you have held?"): start with ₹10 lakh invested, watch a real stretch of
// market history day by day with the future hidden, and decide when to hold, sell or buy back.
(function () {
  const P = window.PP; if (!P) return;
  const { $, esc, fmt, inr, pct, cls, toast, store, DB, ensure, stockSyms, nameOf, chartOpts, autoResize } = P;
  const LC = window.LightweightCharts, T = window.TA;
  const START = 1000000, COST = 0.0012;   // ₹10 lakh, about 0.12% charges per buy or sell

  // Real events, shown when the replay reaches that date. Dates are trading days on/after the event.
  const SCENARIOS = [
    { id: 'mystery', name: '🎲 Mystery stock (name and dates hidden)' },
    { id: 'covid', name: 'Covid crash 2020 · Nifty 50', sym: 'NIFTY50', from: '2020-01-20', len: 250, news: [
      ['2020-01-30', 'India reports its first Covid-19 case.'], ['2020-03-12', 'The WHO has declared Covid-19 a pandemic.'],
      ['2020-03-25', 'A 21-day nationwide lockdown begins across India.'], ['2020-11-10', 'The first successful Covid vaccine trial results have been announced.']] },
    { id: 'gfc', name: 'Global financial crisis 2008 · Nifty 50', sym: 'NIFTY50', from: '2008-01-02', len: 370, news: [
      ['2008-01-21', 'Global markets crash; Indian shares have one of their worst days ever.'], ['2008-09-15', 'US bank Lehman Brothers files for bankruptcy.'],
      ['2008-11-27', 'Terror attacks in Mumbai; the market was shut for a day.'], ['2009-05-18', 'Election results: markets jump so fast that trading is halted.']] },
    { id: 'adani', name: 'Hindenburg report 2023 · Adani Enterprises', sym: 'ADANIENT', from: '2023-01-02', len: 250, news: [
      ['2023-01-25', 'US short-seller Hindenburg Research publishes a report accusing the Adani Group of fraud (the group denies it).'],
      ['2023-02-02', 'Adani Enterprises calls off its ₹20,000 crore share sale.'], ['2023-03-02', 'US investor GQG Partners buys Adani shares worth about ₹15,000 crore.']] },
  ];
  $('chScenario').innerHTML = SCENARIOS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

  const g = { chart: null, series: null, timer: null };
  const st = () => store.get('npt_chal', { played: 0, badges: {} });
  function showBest() { const s = st(); $('chBest').textContent = s.played ? `You've played ${s.played} time${s.played > 1 ? 's' : ''}. ` + Object.entries(s.badges).map(([k, v]) => `${k} ×${v}`).join(' · ') : ''; }
  showBest();

  // Pick a random stock and a random year that contains at least a 20% fall, so there's a real test.
  async function pickMystery() {
    const pool = stockSyms().filter(s => s !== 'INDIAVIX');
    for (let tries = 0; tries < 6; tries++) {
      const sym = pool[Math.floor(Math.random() * pool.length)], B = await ensure(sym); if (!B || B.c.length < 800) continue;
      for (let k = 0; k < 40; k++) {
        const i0 = 250 + Math.floor(Math.random() * (B.c.length - 520)); let pk = 0, dd = 0;
        for (let i = i0; i < i0 + 250; i++) { pk = Math.max(pk, B.c[i]); dd = Math.min(dd, B.c[i] / pk - 1); }
        if (dd <= -0.2) return { B, i0, len: 250, news: [], hidden: true };
      }
    }
    const B = await ensure('NIFTY50'); return { B, i0: B.d.indexOf('2020-01-20'), len: 250, news: [], hidden: true };
  }

  async function start() {
    clearInterval(g.timer); g.timer = null;
    const sc = SCENARIOS.find(s => s.id === $('chScenario').value);
    $('chStart').disabled = true;
    let game;
    if (sc.id === 'mystery') game = await pickMystery();
    else { const B = await ensure(sc.sym); if (!B) { $('chStart').disabled = false; return toast('No data for this scenario'); } let i0 = 0; while (i0 < B.d.length && B.d[i0] < sc.from) i0++; game = { B, i0, len: sc.len, news: sc.news, hidden: false }; }
    $('chStart').disabled = false;
    const { B, i0 } = game, end = Math.min(B.c.length - 1, i0 + game.len);
    const base = game.hidden ? 100 / B.c[i0] : 1;
    Object.assign(g, game, { sc, end, base, i: i0, units: START * (1 - COST) / B.c[i0], cash: 0, invested: true, trades: [{ i: i0, type: 'buy' }], warned: new Set(), seen: new Set(), peak: B.c[i0], firstSellDD: null });
    $('chSetup').hidden = true; $('chResult').hidden = true; $('chGame').hidden = false; $('chNews').hidden = true;
    $('chWhat').textContent = game.hidden ? 'Mystery stock · price shown as 100 at the start' : `${nameOf(B.symbol)} · from ${B.d[i0]}`;
    if (!g.chart) {
      g.chart = LC.createChart($('chChart'), { ...chartOpts(400), crosshair: { mode: 0, vertLine: { labelVisible: false } } }); autoResize(g.chart, $('chChart'));
    }
    if (g.series) g.chart.removeSeries(g.series);
    g.series = g.chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0)', lineWidth: 2, priceLineVisible: false });
    g.chart.applyOptions({ timeScale: { visible: !game.hidden, borderColor: '#232c3b' } });
    g.series.setData([{ time: B.d[i0], value: B.c[i0] * base }]);
    g.chart.timeScale().fitContent();
    draw();
    window.scrollTo({ top: $('tab-challenge').offsetTop - 120, behavior: 'smooth' });
  }

  const value = k => (g.invested ? g.units * g.B.c[k] : g.cash);
  function mood(k) {
    const B = g.B, ddp = B.c[k] / g.peak - 1, w = B.c[k] / B.c[Math.max(g.i0, k - 5)] - 1;
    if (w <= -0.08) return ['😱', 'Panic', `${pct(w * 100, 1)} in a week`];
    if (ddp <= -0.3) return ['😨', 'Despair', `${fmt(-ddp * 100, 0)}% below the high`];
    if (ddp <= -0.15) return ['😟', 'Fear', `${fmt(-ddp * 100, 0)}% below the high`];
    if (w >= 0.06) return ['🤩', 'Euphoria', `${pct(w * 100, 1)} in a week`];
    if (ddp >= -0.02) return ['😎', 'Confident', 'At or near the high'];
    return ['😐', 'Nervous', `${fmt(-ddp * 100, 0)}% below the high`];
  }
  function draw() {
    const k = g.i, v = value(k), ch = (v / START - 1) * 100, [em, word, why] = mood(k);
    $('chValue').textContent = inr(v); $('chValue').className = 'ch-big ' + cls(ch);
    $('chChange').innerHTML = `<span class="${cls(ch)}">${pct(ch, 1)}</span> <span class="muted">since you started · day ${k - g.i0} of ${g.end - g.i0}${g.hidden ? '' : ' · ' + g.B.d[k]}</span>`;
    $('chMood').innerHTML = `<span class="ch-em">${em}</span><div><b>${word}</b><div class="muted small">${why}</div></div>`;
    $('chProg').style.width = (100 * (k - g.i0) / (g.end - g.i0)) + '%';
    $('chSell').hidden = !g.invested; $('chBuy').hidden = g.invested;
    $('chState').textContent = g.invested ? 'You are invested. Do nothing to hold.' : `You are in cash (${inr(g.cash)}). Buy back in whenever you like.`;
    g.series.setMarkers(g.trades.slice(1).map(t => ({ time: g.B.d[t.i], position: t.type === 'sell' ? 'aboveBar' : 'belowBar', color: t.type === 'sell' ? '#ef4444' : '#22c55e', shape: t.type === 'sell' ? 'arrowDown' : 'arrowUp', text: t.type === 'sell' ? 'Sold' : 'Bought' })));
  }
  // Moves one day. Returns true if the game should pause (a big fall or a news event).
  function step() {
    if (g.i >= g.end) { finish(); return true; }
    g.i++; const B = g.B, k = g.i; g.peak = Math.max(g.peak, B.c[k]);
    g.series.update({ time: B.d[k], value: B.c[k] * g.base }); g.chart.timeScale().fitContent();
    let pause = false, msgs = [];
    const n = g.news.find(([d]) => !g.seen.has(d) && B.d[k] >= d);
    if (n) { g.seen.add(n[0]); msgs.push(`📰 <b>${g.hidden ? '' : esc(B.d[k]) + ': '}</b>${esc(n[1])}`); pause = true; }
    const dd = B.c[k] / g.peak - 1;
    if (g.invested) { let hit = 0; for (const lvl of [10, 20, 30, 40, 50]) if (dd <= -lvl / 100 && !g.warned.has(lvl)) { g.warned.add(lvl); hit = lvl; } if (hit) { msgs.push(`⚠️ <b>Down ${hit}% from the high.</b> Hold (press Play), or sell?`); pause = true; } }
    if (msgs.length) { $('chNews').hidden = false; $('chNews').innerHTML = msgs.join('<br>'); }
    draw();
    if (k >= g.end) { finish(); return true; }
    return pause;
  }
  function pause() { clearInterval(g.timer); g.timer = null; $('chPlay').textContent = '▶ Play'; }
  $('chPlay').onclick = () => { if (g.timer) return pause(); $('chPlay').textContent = '⏸ Pause'; g.timer = setInterval(() => { if (step()) pause(); }, 110); };
  $('chWeek').onclick = () => { pause(); for (let n = 0; n < 5; n++) if (step()) break; };
  $('chSell').onclick = () => {
    if (!g.invested) return; const k = g.i; g.cash = g.units * g.B.c[k] * (1 - COST); g.units = 0; g.invested = false; g.trades.push({ i: k, type: 'sell' });
    if (g.firstSellDD === null) g.firstSellDD = { dd: g.B.c[k] / g.peak - 1, px: g.B.c[k], i: k };
    draw(); toast('Sold. You are in cash now.');
  };
  $('chBuy').onclick = () => { if (g.invested) return; const k = g.i; g.units = g.cash * (1 - COST) / g.B.c[k]; g.cash = 0; g.invested = true; g.trades.push({ i: k, type: 'buy' }); draw(); toast('Bought back in.'); };
  $('chEnd').onclick = () => { pause(); g.end = g.i; finish(); };

  // A simple rule to compare with: be invested only while the price is above its 200-day average.
  function ruleValue() {
    const B = g.B, sma = T.sma(B.c, 200); let inv = true, units = START * (1 - COST) / B.c[g.i0], cash = 0;
    for (let k = g.i0 + 1; k <= g.end; k++) {
      if (!(sma[k] === sma[k])) continue;
      if (inv && B.c[k] < sma[k]) { cash = units * B.c[k] * (1 - COST); units = 0; inv = false; }
      else if (!inv && B.c[k] > sma[k]) { units = cash * (1 - COST) / B.c[k]; cash = 0; inv = true; }
    }
    return inv ? units * B.c[g.end] : cash;
  }

  function finish() {
    pause(); if ($('chGame').hidden) return;
    const B = g.B, you = value(g.end), hold = START * (1 - COST) * B.c[g.end] / B.c[g.i0], rule = ruleValue();
    let worst = 0, pk = 0; for (let k = g.i0; k <= g.end; k++) { pk = Math.max(pk, B.c[k]); worst = Math.min(worst, B.c[k] / pk - 1); }
    const sells = g.trades.filter(t => t.type === 'sell').length, moves = g.trades.length - 1;
    let badge, msg;
    if (!sells) { badge = worst < -0.15 ? '💎 Diamond hands' : '🧘 Calm holder'; msg = worst < -0.15 ? `You never sold, even when it was ${fmt(-worst * 100, 0)}% below its high.` : 'You held all the way through.'; }
    else if (you > hold * 1.02) { badge = '🧠 Sharp timing'; msg = `You beat simply holding by ${inr(you - hold)}. One good call can be luck, though. Could you do it again?`; }
    else if (moves >= 6) { badge = '🔁 Over-trader'; msg = `You made ${moves} trades. Each one costs charges and tax, and here it didn't beat just holding.`; }
    else if (you >= hold * 0.98) { badge = '🤝 Close call'; msg = `You ended within 2% of just holding, so the selling and buying back didn't change much.`; }
    else if (g.firstSellDD.dd <= -0.15) { const up = (B.c[g.end] / g.firstSellDD.px - 1) * 100; badge = '😰 Panic seller'; msg = `You first sold after a ${fmt(-g.firstSellDD.dd * 100, 0)}% fall${up > 0 ? `, and by the end the price was ${fmt(up, 0)}% above where you sold` : ''}. Holding would have left you ${inr(hold - you)} better off.`; }
    else { badge = '🏃 Early exit'; msg = `You sold before the big moves were over. Holding would have left you ${inr(hold - you)} better off.`; }
    const s = st(); s.played++; s.badges[badge] = (s.badges[badge] || 0) + 1; store.set('npt_chal', s); showBest();
    const row = (label, v, hi) => `<tr${hi ? ' class="rc-you"' : ''}><td class="l">${label}</td><td>${inr(v)}</td><td class="${cls(v - START)}">${pct((v / START - 1) * 100, 1)}</td></tr>`;
    const realName = `${esc(nameOf(B.symbol))} (${esc(B.symbol)})`, period = `${B.d[g.i0]} to ${B.d[g.end]}`;
    $('chResult').innerHTML = `<div class="ch-badge">${badge}</div><p>${msg}</p>
      ${g.hidden ? `<p class="small">The mystery stock was <b>${realName}</b>, from <b>${period}</b>.</p>` : `<p class="small muted">${realName} · ${period}</p>`}
      <div class="tablewrap"><table class="rc-table"><tr><th class="l">₹10 lakh became</th><th>Value</th><th>Change</th></tr>
        ${row('<b>You</b>', you, true)}${row('Just holding, doing nothing', hold)}${row('A simple rule: hold only above the 200-day average', rule)}</table></div>
      <p class="muted small">The biggest fall from a high during this stretch was ${fmt(-worst * 100, 0)}%. Losing real money feels much worse than losing points in a game.</p>
      <div class="toolbar wrap"><button id="chAgain" class="primary">Play again</button><button id="chShare" class="share-btn">↗ Share my result</button>
        <a href="#backtest/${encodeURIComponent(B.symbol)}" class="small">Backtest a strategy on ${esc(B.symbol)} →</a></div>`;
    $('chGame').hidden = true; $('chSetup').hidden = false; $('chResult').hidden = false;
    $('chAgain').onclick = () => { $('chResult').hidden = true; start(); };
    $('chShare').onclick = async () => {
      const url = location.origin + location.pathname + '#challenge';
      const text = `I played the Crash Challenge on PaperPaisaa and got "${badge.replace(/^\S+\s/, '')}": ₹10 lakh became ${inr(you)}. Could you hold through a crash?`;
      try { if (navigator.share) { await navigator.share({ title: 'PaperPaisaa Crash Challenge', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text + ' ' + url); toast('Copied. Paste it anywhere to share.'); } catch { prompt('Copy this:', text + ' ' + url); }
    };
    $('chResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('chStart').onclick = start;
  P.onTab.challenge = () => { if (g.chart) window.dispatchEvent(new Event('resize')); };
})();
