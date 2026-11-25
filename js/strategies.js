// Strategy library. Each strategy returns a target-position array: 1 = long, -1 = short, 0 = flat.
// Signals are computed on bar i's CLOSE; the backtester executes them at bar i+1's OPEN (no look-ahead).
(function (G) {
  const T = G.TA, N = NaN;
  const val = (a, i) => (typeof a === 'number' ? a : a[i]);
  const ok = (...xs) => xs.every(x => x === x && x != null);
  const xUp = (a, b, i) => i > 0 && ok(val(a, i), val(a, i - 1), val(b, i), val(b, i - 1)) && val(a, i) > val(b, i) && val(a, i - 1) <= val(b, i - 1);
  const xDn = (a, b, i) => i > 0 && ok(val(a, i), val(a, i - 1), val(b, i), val(b, i - 1)) && val(a, i) < val(b, i) && val(a, i - 1) >= val(b, i - 1);
  // State machine from discrete entry/exit events.
  function machine(n, le, lx, se, sx) { const pos = new Array(n).fill(0); let p = 0;
    for (let i = 0; i < n; i++) {
      if (p === 1 && lx && lx(i)) p = 0; else if (p === -1 && sx && sx(i)) p = 0;
      if (p !== 1 && le && le(i)) p = 1; else if (p !== -1 && se && se(i)) p = -1;
      pos[i] = p; } return pos; }
  // Regime: f(i) returns 1/0/-1 directly (or null to keep previous state).
  function regime(n, f) { const pos = new Array(n).fill(0); let p = 0; for (let i = 0; i < n; i++) { const r = f(i); if (r !== null && r !== undefined && r === r) p = r; pos[i] = p; } return pos; }
  // Hold for k bars after entry event.
  function holdN(n, entry, k, side = 1) { const pos = new Array(n).fill(0); let left = 0; for (let i = 0; i < n; i++) { if (left > 0) { pos[i] = side; left--; } if (entry(i) && left === 0) { left = k; pos[i] = side; left--; } } return pos; }
  const dow = (B, i) => new Date(B.d[i] + 'T00:00:00Z').getUTCDay();
  const month = (B, i) => +B.d[i].slice(5, 7);
  const day = (B, i) => +B.d[i].slice(8, 10);
  const body = (B, i) => Math.abs(B.c[i] - B.o[i]);
  const range = (B, i) => B.h[i] - B.l[i];
  const bull = (B, i) => B.c[i] > B.o[i], bear = (B, i) => B.c[i] < B.o[i];

  const S = [];
  const add = (id, name, author, cat, desc, params, fn) => S.push({ id, name, author, cat, desc, params, fn });

  // ───────────── TREND FOLLOWING ─────────────
  add('golden_cross', 'Golden Cross / Death Cross (50/200 SMA)', 'Classic (popularised by Dow theorists, used by many funds)', 'Trend',
    'Go long when the 50-day SMA crosses above the 200-day SMA (golden cross); exit/short when it crosses below (death cross). Slow, low-turnover filter that keeps you in big bull trends and out of most bear markets.',
    { fast: 50, slow: 200 }, (B, p) => { const f = T.sma(B.c, p.fast), s = T.sma(B.c, p.slow); return regime(B.c.length, i => ok(f[i], s[i]) ? (f[i] > s[i] ? 1 : -1) : null); });
  add('ema_9_21', 'EMA 9/21 Crossover', 'Popular swing-trader setup', 'Trend',
    'Long when the 9 EMA crosses above the 21 EMA, short when it crosses below. Faster than SMA crossovers, catches swing moves but whipsaws in ranges.',
    { fast: 9, slow: 21 }, (B, p) => { const f = T.ema(B.c, p.fast), s = T.ema(B.c, p.slow); return regime(B.c.length, i => ok(f[i], s[i]) ? (f[i] > s[i] ? 1 : -1) : null); });
  add('seykota_ema', 'Seykota Exponential MA Crossover', 'Ed Seykota (Market Wizards)', 'Trend',
    'Ed Seykota\'s textbook trend system: long while a fast EMA (15) is above a slow EMA (150), short when below. "The trend is your friend except at the end where it bends."',
    { fast: 15, slow: 150 }, (B, p) => { const f = T.ema(B.c, p.fast), s = T.ema(B.c, p.slow); return regime(B.c.length, i => ok(f[i], s[i]) ? (f[i] > s[i] ? 1 : -1) : null); });
  add('triple_ma', 'Triple Moving Average (4-9-18)', 'R.C. Allen', 'Trend',
    'R.C. Allen\'s 4-9-18 day method: long only when 4 > 9 > 18 SMA are stacked bullishly, short when stacked bearishly, otherwise flat.',
    { a: 4, b: 9, c: 18 }, (B, p) => { const a = T.sma(B.c, p.a), b = T.sma(B.c, p.b), c = T.sma(B.c, p.c); return regime(B.c.length, i => !ok(c[i]) ? null : a[i] > b[i] && b[i] > c[i] ? 1 : a[i] < b[i] && b[i] < c[i] ? -1 : 0); });
  add('faber_10m', 'Faber 10-Month SMA Timing (200-day)', 'Mebane Faber, "A Quantitative Approach to Tactical Asset Allocation"', 'Trend',
    'Hold the asset when price closes above its 10-month (~200-day) SMA, move to cash when below. Famous for cutting drawdowns roughly in half vs buy-and-hold.',
    { period: 200 }, (B, p) => { const s = T.sma(B.c, p.period); return regime(B.c.length, i => ok(s[i]) ? (B.c[i] > s[i] ? 1 : 0) : null); });
  add('price_sma', 'Price vs 50 SMA', 'Classic', 'Trend', 'Long while the close is above the 50-day SMA, short below it. Simple medium-term trend filter.',
    { period: 50 }, (B, p) => { const s = T.sma(B.c, p.period); return regime(B.c.length, i => ok(s[i]) ? (B.c[i] > s[i] ? 1 : -1) : null); });
  add('macd_cross', 'MACD Signal Line Crossover', 'Gerald Appel', 'Trend',
    'Gerald Appel\'s MACD (12,26,9): long when the MACD line crosses above its signal line, short when it crosses below.',
    { fast: 12, slow: 26, signal: 9 }, (B, p) => { const m = T.macdFull(B.c, p.fast, p.slow, p.signal); return regime(B.c.length, i => ok(m.signal[i]) ? (m.macd[i] > m.signal[i] ? 1 : -1) : null); });
  add('macd_zero', 'MACD Zero-Line Cross', 'Gerald Appel', 'Trend', 'Long when the MACD line is above zero (12 EMA above 26 EMA), short below. Slower and fewer whipsaws than the signal-line version.',
    { fast: 12, slow: 26 }, (B, p) => { const m = T.macd(B.c, p.fast, p.slow); return regime(B.c.length, i => ok(m[i]) ? (m[i] > 0 ? 1 : -1) : null); });
  add('supertrend', 'Supertrend (10,3)', 'Olivier Seban', 'Trend',
    'ATR-based trailing band. Long when price closes above the Supertrend line, short when it flips below. Extremely popular among Indian traders on Nifty/BankNifty.',
    { period: 10, mult: 3 }, (B, p) => { const s = T.supertrend(B, p.period, p.mult); return regime(B.c.length, i => ok(s.dir[i]) ? s.dir[i] : null); });
  add('psar', 'Parabolic SAR Stop-and-Reverse', 'J. Welles Wilder Jr.', 'Trend',
    'Wilder\'s Parabolic Stop And Reverse: always in the market, long when price is above the SAR dots, short when below. The stop accelerates as the trend extends.',
    { step: 0.02, max: 0.2 }, (B, p) => { const s = T.psar(B, p.step, p.max); return regime(B.c.length, i => ok(s[i]) ? (B.c[i] > s[i] ? 1 : -1) : null); });
  add('adx_dmi', 'ADX + DMI Trend', 'J. Welles Wilder Jr.', 'Trend',
    'Wilder\'s Directional Movement System: trade only when ADX > 25 (trend is strong). Long when +DI > -DI, short when -DI > +DI. Flat when ADX is weak.',
    { period: 14, th: 25 }, (B, p) => { const a = T.adx(B, p.period); return regime(B.c.length, i => !ok(a.adx[i]) ? null : a.adx[i] < p.th ? 0 : a.pdi[i] > a.mdi[i] ? 1 : -1); });
  add('ichimoku', 'Ichimoku Kinko Hyo Cloud Breakout', 'Goichi Hosoda', 'Trend',
    'Long when price is above the cloud, Tenkan > Kijun, and the cloud is bullish (Span A > Span B); short on the mirror condition; exit when price re-enters the cloud.',
    { tenkan: 9, kijun: 26, senkou: 52 }, (B, p) => { const k = T.ichimoku(B, p.tenkan, p.kijun, p.senkou);
      return regime(B.c.length, i => { if (!ok(k.spanA[i], k.spanB[i])) return null; const top = Math.max(k.spanA[i], k.spanB[i]), bot = Math.min(k.spanA[i], k.spanB[i]);
        if (B.c[i] > top && k.tenkan[i] > k.kijun[i]) return 1; if (B.c[i] < bot && k.tenkan[i] < k.kijun[i]) return -1; if (B.c[i] <= top && B.c[i] >= bot) return 0; return null; }); });
  add('tk_cross', 'Ichimoku Tenkan/Kijun Cross', 'Goichi Hosoda', 'Trend', 'Long when Tenkan-sen crosses above Kijun-sen while price is above the cloud; exit on the reverse cross.',
    {}, B => { const k = T.ichimoku(B); return machine(B.c.length, i => xUp(k.tenkan, k.kijun, i) && B.c[i] > Math.max(k.spanA[i], k.spanB[i]), i => xDn(k.tenkan, k.kijun, i)); });
  add('alligator', 'Williams Alligator', 'Bill Williams, "Trading Chaos"', 'Trend',
    'Long when Lips > Teeth > Jaw (the alligator "eats" upward), short when Lips < Teeth < Jaw, flat when the lines are tangled (alligator sleeping).',
    {}, B => { const a = T.alligator(B); return regime(B.c.length, i => !ok(a.jaw[i]) ? null : a.lips[i] > a.teeth[i] && a.teeth[i] > a.jaw[i] ? 1 : a.lips[i] < a.teeth[i] && a.teeth[i] < a.jaw[i] ? -1 : 0); });
  add('hma_turn', 'Hull MA Slope', 'Alan Hull', 'Trend', 'Long when the Hull Moving Average is rising, short when falling. HMA is designed to be smooth yet nearly lag-free.',
    { period: 21 }, (B, p) => { const h = T.hma(B.c, p.period); return regime(B.c.length, i => ok(h[i], h[i - 1]) ? (h[i] > h[i - 1] ? 1 : -1) : null); });
  add('kama_trend', 'KAMA Adaptive Trend', 'Perry Kaufman, "Trading Systems and Methods"', 'Trend',
    'Kaufman\'s Adaptive Moving Average speeds up in trends and flattens in noise. Long when close > KAMA and KAMA rising; exit when close < KAMA.',
    { period: 10 }, (B, p) => { const k = T.kama(B.c, p.period); return machine(B.c.length, i => ok(k[i], k[i - 1]) && B.c[i] > k[i] && k[i] > k[i - 1], i => B.c[i] < k[i]); });
  add('tema_cross', 'TEMA 10/30 Crossover', 'Patrick Mulloy', 'Trend', 'Triple-EMA crossover (Mulloy, 1994) – less lag than plain EMAs.',
    { fast: 10, slow: 30 }, (B, p) => { const f = T.tema(B.c, p.fast), s = T.tema(B.c, p.slow); return regime(B.c.length, i => ok(f[i], s[i]) ? (f[i] > s[i] ? 1 : -1) : null); });
  add('dema_cross', 'DEMA 20/50 Crossover', 'Patrick Mulloy', 'Trend', 'Double-EMA crossover: long when DEMA20 > DEMA50.',
    { fast: 20, slow: 50 }, (B, p) => { const f = T.dema(B.c, p.fast), s = T.dema(B.c, p.slow); return regime(B.c.length, i => ok(f[i], s[i]) ? (f[i] > s[i] ? 1 : -1) : null); });
  add('guppy', 'Guppy Multiple Moving Average', 'Daryl Guppy', 'Trend',
    'Two ribbons of EMAs: traders (3,5,8,10,12,15) and investors (30,35,40,45,50,60). Long when every short EMA is above every long EMA; short on the reverse; else flat.',
    {}, B => { const sh = [3, 5, 8, 10, 12, 15].map(p => T.ema(B.c, p)), lg = [30, 35, 40, 45, 50, 60].map(p => T.ema(B.c, p));
      return regime(B.c.length, i => { if (!ok(lg[5][i])) return null; const smin = Math.min(...sh.map(a => a[i])), smax = Math.max(...sh.map(a => a[i])), lmin = Math.min(...lg.map(a => a[i])), lmax = Math.max(...lg.map(a => a[i])); return smin > lmax ? 1 : smax < lmin ? -1 : 0; }); });
  add('aroon', 'Aroon Up/Down Cross', 'Tushar Chande', 'Trend', 'Long when Aroon Up > 70 and above Aroon Down, short when Aroon Down > 70 and above Aroon Up.',
    { period: 25 }, (B, p) => { const a = T.aroon(B, p.period); return regime(B.c.length, i => !ok(a.up[i]) ? null : a.up[i] > 70 && a.up[i] > a.dn[i] ? 1 : a.dn[i] > 70 && a.dn[i] > a.up[i] ? -1 : null); });
  add('vortex', 'Vortex Indicator Cross', 'Etienne Botes & Douglas Siepman', 'Trend', 'Long when VI+ crosses above VI-, short when VI- crosses above VI+.',
    { period: 14 }, (B, p) => { const v = T.vortex(B, p.period); return regime(B.c.length, i => ok(v.plus[i]) ? (v.plus[i] > v.minus[i] ? 1 : -1) : null); });
  add('trix', 'TRIX Signal Cross', 'Jack Hutson', 'Trend', 'Long when TRIX (triple-smoothed EMA rate of change) crosses above its 9-period signal, short on the cross below.',
    { period: 15 }, (B, p) => { const t = T.trix(B.c, p.period), s = T.ema(t, 9); return regime(B.c.length, i => ok(s[i]) ? (t[i] > s[i] ? 1 : -1) : null); });
  add('kst', 'Know Sure Thing (KST)', 'Martin Pring', 'Trend', 'Martin Pring\'s weighted multi-timeframe ROC. Long when KST is above its signal line, short when below.',
    {}, B => { const k = T.kst(B.c); return regime(B.c.length, i => ok(k.signal[i]) ? (k.kst[i] > k.signal[i] ? 1 : -1) : null); });
  add('schaff', 'Schaff Trend Cycle', 'Doug Schaff', 'Trend', 'Long when STC rises above 25, exit when it falls below 75. Faster MACD with stochastic smoothing.',
    {}, B => { const s = T.schaff(B.c); return machine(B.c.length, i => xUp(s, 25, i), i => xDn(s, 75, i)); });
  add('linreg_slope', 'Linear Regression Slope', 'Quant classic', 'Trend', 'Long when the 50-day linear-regression slope is positive, short when negative.',
    { period: 50 }, (B, p) => { const l = T.linreg(B.c, p.period); return regime(B.c.length, i => ok(l.slope[i]) ? (l.slope[i] > 0 ? 1 : -1) : null); });
  add('heikin_ashi', 'Heikin-Ashi Trend', 'Munehisa Homma (Japanese technique)', 'Trend', 'Long after 2 consecutive bullish Heikin-Ashi candles with no lower wick; exit after 2 bearish HA candles.',
    {}, B => { const h = T.heikin(B); const bu = i => h.c[i] > h.o[i] && Math.abs(h.l[i] - Math.min(h.o[i], h.c[i])) < 1e-9; const be = i => h.c[i] < h.o[i];
      return machine(B.c.length, i => i > 0 && bu(i) && bu(i - 1), i => i > 0 && be(i) && be(i - 1)); });
  add('dow_theory', 'Dow Theory Higher-Highs/Higher-Lows', 'Charles Dow / William Hamilton', 'Trend',
    'Uptrend = a 20-day high made while the last 20-day low is above the previous one. Long on confirmed higher-high + higher-low structure, exit on a lower low.',
    { period: 20 }, (B, p) => { const hh = T.highest(B.h, p.period), ll = T.lowest(B.l, p.period), llp = T.shift(ll, p.period);
      return machine(B.c.length, i => ok(llp[i]) && B.h[i] >= hh[i] && ll[i] > llp[i], i => ok(llp[i]) && ll[i] < llp[i]); });
  add('elder_impulse', 'Elder Impulse System', 'Dr. Alexander Elder, "Come Into My Trading Room"', 'Trend',
    'Green bar = 13 EMA rising AND MACD histogram rising; red bar = both falling. Long on green, short on red, flat (blue) otherwise.',
    {}, B => { const e = T.ema(B.c, 13), m = T.macdFull(B.c).hist; return regime(B.c.length, i => !ok(m[i], m[i - 1], e[i - 1]) ? null : e[i] > e[i - 1] && m[i] > m[i - 1] ? 1 : e[i] < e[i - 1] && m[i] < m[i - 1] ? -1 : 0); });
  add('weinstein_stage2', 'Weinstein Stage 2 (30-week MA)', 'Stan Weinstein, "Secrets for Profiting in Bull and Bear Markets"', 'Trend',
    'Buy the breakout into Stage 2: price above a rising 150-day (30-week) SMA with volume above average. Exit when price closes below the 150-day SMA (Stage 3/4).',
    { period: 150 }, (B, p) => { const s = T.sma(B.c, p.period), v = T.sma(B.v, 50); return machine(B.c.length, i => ok(s[i], s[i - 5]) && B.c[i] > s[i] && s[i] > s[i - 5] && B.v[i] > v[i], i => B.c[i] < s[i]); });
  add('minervini_tt', 'Minervini Trend Template', 'Mark Minervini, "Trade Like a Stock Market Wizard"', 'Trend',
    'Long only when: price > 50 > 150 > 200 SMA, 200 SMA rising for 1 month, price ≥ 30% above 52-week low and within 25% of 52-week high. Exit when price closes below the 50-day SMA.',
    {}, B => { const s50 = T.sma(B.c, 50), s150 = T.sma(B.c, 150), s200 = T.sma(B.c, 200), hi = T.highest(B.h, 252), lo = T.lowest(B.l, 252);
      return machine(B.c.length, i => ok(s200[i], s200[i - 21], hi[i]) && B.c[i] > s50[i] && s50[i] > s150[i] && s150[i] > s200[i] && s200[i] > s200[i - 21] && B.c[i] >= 1.3 * lo[i] && B.c[i] >= 0.75 * hi[i], i => B.c[i] < s50[i]); });
  add('mtf_trend', 'Multi-Timeframe Trend Alignment', 'Common institutional filter', 'Trend', 'Long when close > 20 EMA > 50 EMA > 200 EMA (short, medium and long trends aligned). Exit when close < 20 EMA.',
    {}, B => { const a = T.ema(B.c, 20), b = T.ema(B.c, 50), c = T.ema(B.c, 200); return machine(B.c.length, i => ok(c[i]) && B.c[i] > a[i] && a[i] > b[i] && b[i] > c[i], i => B.c[i] < a[i]); });
  add('zlema_trend', 'Zero-Lag EMA Trend', 'John Ehlers & Ric Way', 'Trend', 'Long when close is above the 20-period zero-lag EMA, short when below.',
    { period: 20 }, (B, p) => { const z = T.zlema(B.c, p.period); return regime(B.c.length, i => ok(z[i]) ? (B.c[i] > z[i] ? 1 : -1) : null); });
  add('vwma_sma', 'VWMA vs SMA (Volume Confirmation)', 'Buff Dormeier', 'Trend', 'Long when the 20-day volume-weighted MA is above the 20-day SMA (volume is confirming up moves), short when below.',
    { period: 20 }, (B, p) => { const a = T.vwma(B.c, B.v, p.period), b = T.sma(B.c, p.period); return regime(B.c.length, i => ok(a[i], b[i]) ? (a[i] > b[i] ? 1 : -1) : null); });

  // ───────────── BREAKOUT / CHANNEL ─────────────
  add('turtle_20', 'Turtle Trading System 1 (20/10 Donchian)', 'Richard Dennis & William Eckhardt (The Turtles)', 'Breakout',
    'The original Turtle System 1: buy a breakout to a new 20-day high, exit on a 10-day low. Mirror for shorts. Pair with a 2-ATR stop in the settings for the full rules.',
    { entry: 20, exit: 10 }, (B, p) => { const eh = T.shift(T.highest(B.h, p.entry)), el = T.shift(T.lowest(B.l, p.entry)), xh = T.shift(T.highest(B.h, p.exit)), xl = T.shift(T.lowest(B.l, p.exit));
      return machine(B.c.length, i => B.c[i] > eh[i], i => B.c[i] < xl[i], i => B.c[i] < el[i], i => B.c[i] > xh[i]); });
  add('turtle_55', 'Turtle Trading System 2 (55/20 Donchian)', 'Richard Dennis & William Eckhardt (The Turtles)', 'Breakout',
    'Turtle System 2: enter on a 55-day breakout, exit on a 20-day opposite breakout. Catches only the biggest trends.',
    { entry: 55, exit: 20 }, (B, p) => { const eh = T.shift(T.highest(B.h, p.entry)), el = T.shift(T.lowest(B.l, p.entry)), xh = T.shift(T.highest(B.h, p.exit)), xl = T.shift(T.lowest(B.l, p.exit));
      return machine(B.c.length, i => B.c[i] > eh[i], i => B.c[i] < xl[i], i => B.c[i] < el[i], i => B.c[i] > xh[i]); });
  add('donchian_4wk', 'Donchian 4-Week Rule', 'Richard Donchian ("father of trend following")', 'Breakout',
    'Donchian\'s 4-week rule: always in the market – long when price exceeds the prior 4-week (20-day) high, short when it breaks the prior 4-week low.',
    { period: 20 }, (B, p) => { const h = T.shift(T.highest(B.h, p.period)), l = T.shift(T.lowest(B.l, p.period)); return regime(B.c.length, i => B.c[i] > h[i] ? 1 : B.c[i] < l[i] ? -1 : null); });
  add('darvas', 'Darvas Box Breakout', 'Nicolas Darvas, "How I Made $2,000,000 in the Stock Market"', 'Breakout',
    'Price consolidates in a "box" (new 52-week-high region, then a range). Buy when price breaks above the box top on above-average volume; stop at the box bottom.',
    { box: 15 }, (B, p) => { const top = T.shift(T.highest(B.h, p.box)), bot = T.shift(T.lowest(B.l, p.box)), hi = T.highest(B.h, 252), v = T.sma(B.v, 50); let stop = 0;
      return machine(B.c.length, i => { const e = ok(top[i], hi[i]) && B.c[i] > top[i] && top[i] >= 0.9 * hi[i] && B.v[i] > 1.3 * v[i]; if (e) stop = bot[i]; return e; }, i => B.c[i] < stop); });
  add('livermore', 'Livermore Pivotal Point Breakout', 'Jesse Livermore, "How to Trade in Stocks"', 'Breakout',
    'Livermore bought only when a stock broke out to new high ground through a "pivotal point" with strong volume, and cut losses quickly. Buy a 60-day high with volume > 1.5× average; exit on a 20-day low.',
    { period: 60 }, (B, p) => { const h = T.shift(T.highest(B.h, p.period)), l = T.shift(T.lowest(B.l, 20)), v = T.sma(B.v, 50); return machine(B.c.length, i => B.c[i] > h[i] && B.v[i] > 1.5 * v[i], i => B.c[i] < l[i]); });
  add('high_52w', '52-Week High Momentum', 'George & Hwang (2004), used by O\'Neil & Minervini', 'Breakout',
    'Stocks at 52-week highs tend to keep rising (anchoring bias). Buy a close at a new 52-week high; exit when price falls 15% from the 52-week high or below the 100 SMA.',
    {}, B => { const h = T.highest(B.h, 252), s = T.sma(B.c, 100); return machine(B.c.length, i => ok(h[i]) && B.h[i] >= h[i], i => B.c[i] < 0.85 * h[i] || B.c[i] < s[i]); });
  add('canslim_breakout', 'CAN SLIM Style Base Breakout', 'William J. O\'Neil (IBD), "How to Make Money in Stocks"', 'Breakout',
    'Technical side of CAN SLIM: buy when price breaks to a new 50-day high from within 15% of its 52-week high on volume ≥ 1.5× average, in a market uptrend (above 200 SMA). Sell on a 7–8% loss or close under the 50-day line.',
    {}, B => { const h50 = T.shift(T.highest(B.h, 50)), h252 = T.highest(B.h, 252), v = T.sma(B.v, 50), s200 = T.sma(B.c, 200), s50 = T.sma(B.c, 50); let entry = 0;
      return machine(B.c.length, i => { const e = ok(h252[i], s200[i]) && B.c[i] > h50[i] && B.c[i] > 0.85 * h252[i] && B.v[i] > 1.5 * v[i] && B.c[i] > s200[i]; if (e) entry = B.c[i]; return e; }, i => B.c[i] < entry * 0.92 || B.c[i] < s50[i]); });
  add('bb_breakout', 'Bollinger Band Breakout', 'John Bollinger', 'Breakout', 'Long when price closes above the upper Bollinger Band (momentum breakout), exit when it closes back below the middle band. Mirror for shorts.',
    { period: 20, mult: 2 }, (B, p) => { const b = T.bollinger(B.c, p.period, p.mult); return machine(B.c.length, i => B.c[i] > b.up[i], i => B.c[i] < b.mid[i], i => B.c[i] < b.lo[i], i => B.c[i] > b.mid[i]); });
  add('keltner_breakout', 'Keltner Channel Breakout', 'Chester Keltner (1960), Linda Raschke variant', 'Breakout', 'Long when close > upper Keltner Channel (EMA20 + 2 ATR), exit at the EMA20. Mirror for shorts.',
    { period: 20, mult: 2 }, (B, p) => { const k = T.keltner(B, p.period, p.mult); return machine(B.c.length, i => B.c[i] > k.up[i], i => B.c[i] < k.mid[i], i => B.c[i] < k.lo[i], i => B.c[i] > k.mid[i]); });
  add('ttm_squeeze', 'TTM Squeeze Breakout', 'John Carter, "Mastering the Trade"', 'Breakout',
    'Volatility "squeeze": Bollinger Bands inside Keltner Channels. When the squeeze fires (BB expands outside KC), trade in the direction of momentum (close vs 20 SMA). Exit when momentum fades.',
    {}, B => { const b = T.bollinger(B.c, 20, 2), k = T.keltner(B, 20, 1.5), hh = T.highest(B.h, 20), ll = T.lowest(B.l, 20), mom = T.linreg(B.c.map((c, i) => c - (hh[i] + ll[i]) / 2), 20).value;
      const sq = i => b.up[i] < k.up[i] && b.lo[i] > k.lo[i]; return machine(B.c.length, i => i > 0 && sq(i - 1) && !sq(i) && mom[i] > 0, i => mom[i] < mom[i - 1], i => i > 0 && sq(i - 1) && !sq(i) && mom[i] < 0, i => mom[i] > mom[i - 1]); });
  add('nr7', 'NR7 Breakout', 'Toby Crabel, "Day Trading with Short Term Price Patterns"', 'Breakout',
    'NR7 = the narrowest daily range of the last 7 days (volatility contraction). Buy a break above the NR7 bar\'s high on the next bar, hold 5 days.',
    { hold: 5 }, (B, p) => { const n = B.c.length; const nr7 = i => { if (i < 7) return false; for (let k = 1; k < 7; k++) if (range(B, i - k) <= range(B, i)) return false; return true; };
      return holdN(n, i => i > 0 && nr7(i - 1) && B.c[i] > B.h[i - 1], p.hold); });
  add('nr4_ib', 'NR4 + Inside Bar Breakout', 'Toby Crabel', 'Breakout', 'An inside bar that is also the narrowest range of 4 days (NR4/ID). Buy a close above its high, hold 3 days.',
    { hold: 3 }, (B, p) => { const nr4 = i => i >= 4 && [1, 2, 3].every(k => range(B, i - k) > range(B, i)) && B.h[i] < B.h[i - 1] && B.l[i] > B.l[i - 1];
      return holdN(B.c.length, i => i > 0 && nr4(i - 1) && B.c[i] > B.h[i - 1], p.hold); });
  add('inside_bar', 'Inside Bar Breakout', 'Price-action classic (Al Brooks, Nial Fuller)', 'Breakout', 'After an inside bar (range inside the previous bar) in an uptrend (above 50 EMA), buy a close above the mother bar\'s high; exit on a close below the mother bar\'s low or after 10 bars.',
    {}, B => { const e = T.ema(B.c, 50); let lo = 0, cnt = 0; return machine(B.c.length, i => { const ib = i > 1 && B.h[i - 1] < B.h[i - 2] && B.l[i - 1] > B.l[i - 2]; const r = ib && B.c[i] > B.h[i - 2] && B.c[i] > e[i]; if (r) { lo = B.l[i - 2]; cnt = 0; } return r; }, i => ++cnt > 10 || B.c[i] < lo); });
  add('vol_breakout_lw', 'Larry Williams Volatility Breakout', 'Larry Williams (1987 World Cup Championship, +11,376%)', 'Breakout',
    'Buy when today\'s close exceeds today\'s open + 0.6 × yesterday\'s range (a daily-bar approximation of his intraday breakout). Exit at the next profitable close or after 3 days.',
    { k: 0.6 }, (B, p) => { let cnt = 0, ep = 0; return machine(B.c.length, i => { const e = i > 0 && B.c[i] > B.o[i] + p.k * range(B, i - 1); if (e) { cnt = 0; ep = B.c[i]; } return e; }, i => ++cnt >= 3 || B.c[i] > ep * 1.0001 && cnt >= 1); });
  add('opening_gap', 'Gap-and-Go (Breakaway Gap)', 'Classic momentum day-trader setup', 'Breakout', 'Buy when the stock gaps up > 2% above yesterday\'s high and closes near its high (top 25% of the range). Hold 5 days.',
    { gap: 2, hold: 5 }, (B, p) => holdN(B.c.length, i => i > 0 && B.o[i] > B.h[i - 1] * (1 + p.gap / 100) && (B.c[i] - B.l[i]) >= 0.75 * range(B, i), p.hold));
  add('pocket_pivot', 'Pocket Pivot', 'Gil Morales & Chris Kacher (O\'Neil associates)', 'Breakout',
    'Up-day volume greater than the highest down-day volume of the prior 10 days, with price above the 10 and 50 SMA. Early-entry signal within a base. Exit below the 50 SMA.',
    {}, B => { const s10 = T.sma(B.c, 10), s50 = T.sma(B.c, 50); return machine(B.c.length, i => { if (!ok(s50[i]) || !(B.c[i] > B.c[i - 1])) return false; let mx = 0; for (let k = 1; k <= 10; k++) if (B.c[i - k] < B.c[i - k - 1]) mx = Math.max(mx, B.v[i - k]); return B.v[i] > mx && B.c[i] > s10[i] && B.c[i] > s50[i]; }, i => B.c[i] < s50[i]); });
  add('vcp', 'Volatility Contraction Pattern (VCP)', 'Mark Minervini', 'Breakout',
    'Approximation of Minervini\'s VCP: in an uptrend (above 150 SMA), 10-day ATR has contracted to < 60% of the 50-day ATR, then price breaks a 20-day high. Exit below the 50 SMA.',
    {}, B => { const a10 = T.atr(B, 10), a50 = T.atr(B, 50), h = T.shift(T.highest(B.h, 20)), s150 = T.sma(B.c, 150), s50 = T.sma(B.c, 50);
      return machine(B.c.length, i => ok(s150[i], a50[i]) && B.c[i] > s150[i] && a10[i - 1] < 0.6 * a50[i - 1] && B.c[i] > h[i], i => B.c[i] < s50[i]); });
  add('cup_handle', 'Cup & Handle Breakout (approx.)', 'William J. O\'Neil', 'Breakout',
    'Approximation: price recovered to within 5% of a 6-month high after a 12–35% correction (the cup), had a shallow 5–15% pullback over 5–20 days (the handle), then breaks the handle high on volume. Exit 8% stop or 50 SMA.',
    {}, B => { const h126 = T.highest(B.h, 126), l126 = T.lowest(B.l, 126), hh = T.shift(T.highest(B.h, 15)), ll = T.lowest(B.l, 15), v = T.sma(B.v, 50), s50 = T.sma(B.c, 50); let ent = 0;
      return machine(B.c.length, i => { if (!ok(h126[i], v[i])) return false; const depth = 1 - l126[i] / h126[i], handle = 1 - ll[i] / hh[i];
        const e = depth > 0.12 && depth < 0.35 && handle > 0.05 && handle < 0.15 && hh[i] > 0.95 * h126[i] && B.c[i] > hh[i] && B.v[i] > 1.4 * v[i]; if (e) ent = B.c[i]; return e; }, i => B.c[i] < 0.92 * ent || B.c[i] < s50[i]); });
  add('channel_breakout_atr', 'ATR Channel Breakout', 'Trend-following CTA style (Chesapeake Capital)', 'Breakout', 'Long when close > 50-day SMA + 2 ATR(20); exit when close < 50 SMA. Mirror for shorts.',
    {}, B => { const s = T.sma(B.c, 50), a = T.atr(B, 20); return machine(B.c.length, i => B.c[i] > s[i] + 2 * a[i], i => B.c[i] < s[i], i => B.c[i] < s[i] - 2 * a[i], i => B.c[i] > s[i]); });
  add('fractal_breakout', 'Fractal Breakout', 'Bill Williams', 'Breakout', 'Buy when price closes above the most recent up-fractal (confirmed 5-bar swing high) while above the Alligator teeth; exit below the latest down-fractal.',
    {}, B => { const f = T.fractals(B), a = T.alligator(B); let up = Infinity, dn = -Infinity; return machine(B.c.length, i => { if (f.up[i]) up = B.h[i - 2]; if (f.dn[i]) dn = B.l[i - 2]; return B.c[i] > up && B.c[i] > a.teeth[i]; }, i => B.c[i] < dn); });
  add('pivot_breakout', 'Floor Pivot R1 Breakout', 'Floor traders (classic pivot points)', 'Breakout', 'Long when close breaks above yesterday\'s R1 pivot, exit when it falls back below the pivot P. Mirror below S1.',
    {}, B => { const p = T.pivots(B); return machine(B.c.length, i => B.c[i] > p.r1[i], i => B.c[i] < p.p[i], i => B.c[i] < p.s1[i], i => B.c[i] > p.p[i]); });
  add('range_expansion', 'Wide-Range Bar Breakout', 'Toby Crabel / Linda Raschke', 'Breakout', 'Range expansion: today\'s range > 2× the 20-day average range and close in the top 20% → buy, hold 5 days.',
    {}, B => { const r = T.sma(B.h.map((h, i) => h - B.l[i]), 20); return holdN(B.c.length, i => ok(r[i]) && range(B, i) > 2 * r[i] && B.c[i] > B.h[i] - 0.2 * range(B, i), 5); });

  // ───────────── MEAN REVERSION ─────────────
  add('rsi_30_70', 'RSI 30/70 Reversal', 'J. Welles Wilder Jr. (1978)', 'Mean Reversion', 'Classic RSI: buy when RSI(14) crosses up through 30 (leaving oversold), sell when it crosses down through 70.',
    { period: 14, lo: 30, hi: 70 }, (B, p) => { const r = T.rsi(B.c, p.period); return machine(B.c.length, i => xUp(r, p.lo, i), i => xDn(r, p.hi, i)); });
  add('connors_rsi2', 'Connors RSI(2) Pullback', 'Larry Connors, "Short Term Trading Strategies That Work"', 'Mean Reversion',
    'In a long-term uptrend (close > 200 SMA), buy when 2-period RSI drops below 10. Exit when close rises above the 5-day SMA. One of the most-tested mean-reversion edges.',
    { lo: 10 }, (B, p) => { const r = T.rsi(B.c, 2), s200 = T.sma(B.c, 200), s5 = T.sma(B.c, 5); return machine(B.c.length, i => ok(s200[i]) && B.c[i] > s200[i] && r[i] < p.lo, i => B.c[i] > s5[i]); });
  add('cumulative_rsi', 'Cumulative RSI(2)', 'Larry Connors & Cesar Alvarez', 'Mean Reversion', 'Sum of the last 2 days\' RSI(2) below 35 while above the 200 SMA → buy; exit when RSI(2) > 65.',
    {}, B => { const r = T.rsi(B.c, 2), s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i], r[i - 1]) && B.c[i] > s[i] && r[i] + r[i - 1] < 35, i => r[i] > 65); });
  add('connors_crsi', 'Connors RSI (CRSI) Strategy', 'Connors Research', 'Mean Reversion', 'Buy when the composite Connors RSI (RSI3 + streak RSI + ROC percentile) falls below 10 above the 200 SMA; exit when CRSI > 70.',
    {}, B => { const c = T.connorsRsi(B.c), s = T.sma(B.c, 200); return machine(B.c.length, i => ok(c[i], s[i]) && c[i] < 10 && B.c[i] > s[i], i => c[i] > 70); });
  add('double_7s', 'Double 7\'s', 'Larry Connors', 'Mean Reversion', 'Above the 200 SMA, buy at a 7-day closing low; sell at a 7-day closing high.',
    {}, B => { const s = T.sma(B.c, 200), l7 = T.lowest(B.c, 7), h7 = T.highest(B.c, 7); return machine(B.c.length, i => ok(s[i]) && B.c[i] > s[i] && B.c[i] <= l7[i], i => B.c[i] >= h7[i]); });
  add('three_day_hl', '3-Day High/Low Method', 'Larry Connors', 'Mean Reversion', 'Above the 200 SMA and below the 5 SMA, buy after 3 consecutive lower highs AND lower lows; exit when close > 5 SMA.',
    {}, B => { const s200 = T.sma(B.c, 200), s5 = T.sma(B.c, 5); return machine(B.c.length, i => ok(s200[i]) && B.c[i] > s200[i] && B.c[i] < s5[i] && [0, 1, 2].every(k => B.h[i - k] < B.h[i - k - 1] && B.l[i - k] < B.l[i - k - 1]), i => B.c[i] > s5[i]); });
  add('r3', 'R3 Strategy', 'Larry Connors', 'Mean Reversion', 'Above the 200 SMA, RSI(2) drops 3 days in a row with the first drop starting below 60 and today below 10 → buy. Exit when RSI(2) > 70.',
    {}, B => { const r = T.rsi(B.c, 2), s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i], r[i - 3]) && B.c[i] > s[i] && r[i] < r[i - 1] && r[i - 1] < r[i - 2] && r[i - 2] < 60 && r[i] < 10, i => r[i] > 70); });
  add('pct_b', '%b Strategy', 'Larry Connors / John Bollinger', 'Mean Reversion', 'Above the 200 SMA, buy after 3 consecutive closes with Bollinger %b < 0.2; exit when %b > 0.8.',
    {}, B => { const b = T.bollinger(B.c, 5, 1).pb, s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i]) && B.c[i] > s[i] && b[i] < 0.2 && b[i - 1] < 0.2 && b[i - 2] < 0.2, i => b[i] > 0.8); });
  add('bb_reversion', 'Bollinger Band Mean Reversion', 'John Bollinger', 'Mean Reversion', 'Buy a close below the lower band, sell at the middle band. Short above the upper band, cover at the middle.',
    { period: 20, mult: 2 }, (B, p) => { const b = T.bollinger(B.c, p.period, p.mult); return machine(B.c.length, i => B.c[i] < b.lo[i], i => B.c[i] > b.mid[i], i => B.c[i] > b.up[i], i => B.c[i] < b.mid[i]); });
  add('bb_double', 'Double Bollinger Bands', 'Kathy Lien', 'Mean Reversion', 'Two sets of bands (1σ and 2σ). Buy when price closes above the +1σ band, entering the +1σ to +2σ "buy zone"; exit when it falls back below the 20 SMA.',
    {}, B => { const b1 = T.bollinger(B.c, 20, 1); return machine(B.c.length, i => xUp(B.c, b1.up, i), i => B.c[i] < b1.mid[i]); });
  add('rsi_50_trend_pullback', 'RSI(14) 40-Pullback in Uptrend', 'Andrew Cardwell (RSI range rules)', 'Mean Reversion', 'Cardwell: in bull markets RSI holds 40–80. Above the 200 SMA, buy when RSI(14) dips under 40; exit when RSI > 70.',
    {}, B => { const r = T.rsi(B.c, 14), s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i]) && B.c[i] > s[i] && r[i] < 40, i => r[i] > 70); });
  add('stoch_os', 'Stochastic Oversold Cross', 'George Lane', 'Mean Reversion', 'Buy when %K crosses above %D below 20; sell when %K crosses below %D above 80.',
    {}, B => { const s = T.stoch(B); return machine(B.c.length, i => xUp(s.k, s.d, i) && s.k[i] < 25, i => xDn(s.k, s.d, i) && s.k[i] > 75); });
  add('stochrsi', 'Stochastic RSI Reversal', 'Tushar Chande & Stanley Kroll', 'Mean Reversion', 'Buy when StochRSI %K crosses above 20, sell when it crosses below 80.',
    {}, B => { const s = T.stochRsi(B.c); return machine(B.c.length, i => xUp(s.k, 20, i), i => xDn(s.k, 80, i)); });
  add('williams_r', 'Williams %R Oversold', 'Larry Williams', 'Mean Reversion', 'Buy when %R(14) crosses up through -80; sell when it crosses down through -20.',
    {}, B => { const w = T.willr(B, 14); return machine(B.c.length, i => xUp(w, -80, i), i => xDn(w, -20, i)); });
  add('cci_reversal', 'CCI ±100 Reversal', 'Donald Lambert', 'Mean Reversion', 'Buy when CCI(20) crosses back above -100; exit when CCI crosses below +100.',
    {}, B => { const c = T.cci(B, 20); return machine(B.c.length, i => xUp(c, -100, i), i => xDn(c, 100, i)); });
  add('mfi_reversal', 'Money Flow Index 20/80', 'Gene Quong & Avrum Soudack', 'Mean Reversion', 'Volume-weighted RSI. Buy when MFI crosses above 20, sell when it crosses below 80.',
    {}, B => { const m = T.mfi(B, 14); return machine(B.c.length, i => xUp(m, 20, i), i => xDn(m, 80, i)); });
  add('zscore_rev', 'Z-Score Mean Reversion', 'Statistical arbitrage desks', 'Mean Reversion', 'Buy when the 20-day z-score of price is below -2, exit when it returns above 0. Short at +2.',
    {}, B => { const z = T.zscore(B.c, 20); return machine(B.c.length, i => z[i] < -2, i => z[i] > 0, i => z[i] > 2, i => z[i] < 0); });
  add('ibs', 'Internal Bar Strength (IBS)', 'Quantitative research (Pagonidis 2014)', 'Mean Reversion', 'IBS = (C−L)/(H−L). Buy when IBS < 0.2 (closed near the low), exit when IBS > 0.8.',
    {}, B => { const ibs = i => range(B, i) ? (B.c[i] - B.l[i]) / range(B, i) : 0.5; return machine(B.c.length, i => ibs(i) < 0.2, i => ibs(i) > 0.8); });
  add('raschke_8020', 'Raschke 80-20', 'Linda Bradford Raschke, "Street Smarts"', 'Mean Reversion', 'Yesterday opened in the top 20% of its range and closed in the bottom 20%. Buy today if price trades back above yesterday\'s low after taking it out. Hold 2–4 days.',
    {}, B => holdN(B.c.length, i => i > 1 && (B.o[i - 1] - B.l[i - 1]) >= 0.8 * range(B, i - 1) && (B.c[i - 1] - B.l[i - 1]) <= 0.2 * range(B, i - 1) && B.l[i] < B.l[i - 1] && B.c[i] > B.l[i - 1], 3));
  add('turtle_soup', 'Turtle Soup', 'Linda Raschke & Larry Connors, "Street Smarts"', 'Mean Reversion', 'Fades failed Turtle breakouts: price makes a new 20-day low (the prior 20-day low was ≥4 days old) but closes back above that prior low → buy, hold 5 days.',
    {}, B => { const l = T.shift(T.lowest(B.l, 20)); return holdN(B.c.length, i => { if (!ok(l[i])) return false; let age = 0; for (let k = 1; k <= 20; k++) if (B.l[i - k] === l[i]) { age = k; break; } return age >= 4 && B.l[i] < l[i] && B.c[i] > l[i]; }, 5); });
  add('williams_oops', 'Larry Williams "Oops!"', 'Larry Williams', 'Mean Reversion', 'Today opens with a gap below yesterday\'s low, then rallies to close above yesterday\'s low (trapped sellers) → buy, hold 3 days.',
    {}, B => holdN(B.c.length, i => i > 0 && B.o[i] < B.l[i - 1] && B.c[i] > B.l[i - 1], 3));
  add('holy_grail', 'Holy Grail (ADX Pullback)', 'Linda Raschke', 'Mean Reversion', 'When ADX(14) > 30 and +DI > -DI (strong uptrend), buy the first pullback to the 20 EMA; exit at the recent 20-day high or if close < 20 EMA − 1 ATR.',
    {}, B => { const a = T.adx(B), e = T.ema(B.c, 20), at = T.atr(B, 14), h = T.highest(B.h, 20); return machine(B.c.length, i => ok(a.adx[i]) && a.adx[i] > 30 && a.pdi[i] > a.mdi[i] && B.l[i] <= e[i] && B.c[i] > e[i], i => B.h[i] >= h[i - 1] || B.c[i] < e[i] - at[i]); });
  add('anti', 'The "Anti" Setup', 'Linda Raschke', 'Mean Reversion', 'Stochastic (7,10) %D trending up while %K pulls back then hooks up → buy in direction of the slow trend. Exit after 4 days.',
    {}, B => { const s = T.stoch(B, 7, 10, 1); return holdN(B.c.length, i => ok(s.d[i - 3]) && s.d[i] > s.d[i - 3] && s.k[i - 1] < s.k[i - 2] && s.k[i] > s.k[i - 1] && s.k[i] < 50, 4); });
  add('kc_reversion', 'Keltner Channel Fade', 'Chester Keltner', 'Mean Reversion', 'Buy closes below the lower Keltner Channel (EMA20 − 2 ATR), exit at the EMA.',
    {}, B => { const k = T.keltner(B, 20, 2); return machine(B.c.length, i => B.c[i] < k.lo[i], i => B.c[i] > k.mid[i]); });
  add('down_streak', 'Consecutive Down Days', 'Quant classic', 'Mean Reversion', 'Above the 200 SMA, buy after 4 consecutive down closes; exit on the first up close.',
    { n: 4 }, (B, p) => { const s = T.sma(B.c, 200); return machine(B.c.length, i => { if (!ok(s[i]) || B.c[i] < s[i]) return false; for (let k = 0; k < p.n; k++) if (!(B.c[i - k] < B.c[i - k - 1])) return false; return true; }, i => B.c[i] > B.c[i - 1]); });
  add('gap_fill', 'Gap Down Fade', 'Market-maker / floor trader setup', 'Mean Reversion', 'Buy a gap down of more than 2% when the stock is above its 200 SMA; sell at the close of the next day.',
    {}, B => { const s = T.sma(B.c, 200); return holdN(B.c.length, i => ok(s[i]) && i > 0 && B.o[i] < B.c[i - 1] * 0.98 && B.c[i] > s[i], 2); });
  add('fib_pullback', 'Fibonacci 61.8% Retracement', 'Leonardo Fibonacci / Elliott wave traders', 'Mean Reversion',
    'In an uptrend (above 200 SMA), buy when price retraces to the 50–61.8% zone of the last 60-day swing (low→high) and closes up; exit at the swing high or below the 78.6% level.',
    {}, B => { const h = T.highest(B.h, 60), l = T.lowest(B.l, 60), s = T.sma(B.c, 200); let tgt = 0, stp = 0;
      return machine(B.c.length, i => { if (!ok(s[i], h[i])) return false; const r50 = h[i] - 0.5 * (h[i] - l[i]), r618 = h[i] - 0.618 * (h[i] - l[i]); const e = B.c[i] > s[i] && B.l[i] <= r50 && B.l[i] >= r618 * 0.99 && B.c[i] > B.o[i]; if (e) { tgt = h[i]; stp = h[i] - 0.786 * (h[i] - l[i]); } return e; }, i => B.c[i] >= tgt || B.c[i] < stp); });
  add('dpo_rev', 'DPO Cycle Reversal', 'Detrended Price Oscillator (cycle analysts)', 'Mean Reversion', 'Buy when DPO(20) crosses up from below its −1 stdev level; exit when DPO > 0.',
    {}, B => { const d = T.dpo(B.c, 20), sd = T.stdev(d, 60); return machine(B.c.length, i => ok(sd[i]) && xUp(d, -sd[i], i), i => d[i] > 0); });
  add('fisher_rev', 'Ehlers Fisher Transform Reversal', 'John Ehlers', 'Mean Reversion', 'Buy when the Fisher Transform crosses up from below −1.5; sell when it crosses down from above +1.5.',
    {}, B => { const f = T.fisher(B, 10), fs = T.shift(f); return machine(B.c.length, i => xUp(f, fs, i) && f[i] < -1.5, i => xDn(f, fs, i) && f[i] > 1.5); });
  add('vwap_rev', 'VWAP Reversion', 'Institutional execution traders', 'Mean Reversion', 'Buy when price is 1.5 ATR below the 20-day rolling VWAP; exit at VWAP.',
    {}, B => { const v = T.vwapRolling(B, 20), a = T.atr(B, 14); return machine(B.c.length, i => B.c[i] < v[i] - 1.5 * a[i], i => B.c[i] > v[i]); });
  add('cmo_rev', 'Chande Momentum Oscillator ±50', 'Tushar Chande', 'Mean Reversion', 'Buy when CMO(14) crosses up through −50, sell when it crosses down through +50.',
    {}, B => { const c = T.cmo(B.c, 14); return machine(B.c.length, i => xUp(c, -50, i), i => xDn(c, 50, i)); });
  add('uo_rev', 'Ultimate Oscillator Bullish Setup', 'Larry Williams', 'Mean Reversion', 'Buy when the Ultimate Oscillator crosses above 30 after being oversold; sell above 70.',
    {}, B => { const u = T.uo(B); return machine(B.c.length, i => xUp(u, 30, i), i => xDn(u, 70, i)); });
  add('rsi_divergence', 'RSI Bullish Divergence', 'Wilder / Constance Brown', 'Mean Reversion', 'Price makes a lower 20-day low while RSI(14) makes a higher low and RSI < 40 → buy. Exit when RSI > 65.',
    {}, B => { const r = T.rsi(B.c, 14), l = T.lowest(B.l, 20); return machine(B.c.length, i => { if (i < 25 || !ok(r[i])) return false; if (B.l[i] > l[i]) return false; let j = -1; for (let k = 5; k < 20; k++) if (B.l[i - k] === l[i - k] && B.l[i - k] > B.l[i]) { j = i - k; break; } return j > 0 && r[i] > r[j] && r[i] < 40; }, i => r[i] > 65); });
  add('macd_divergence', 'MACD Bullish Divergence', 'Gerald Appel / Thomas Aspray', 'Mean Reversion', 'Price at a 30-day low but MACD histogram higher than at the previous low → buy. Exit when MACD crosses below signal.',
    {}, B => { const m = T.macdFull(B.c), l = T.lowest(B.l, 30); return machine(B.c.length, i => { if (i < 40 || !ok(m.hist[i])) return false; if (B.l[i] > l[i]) return false; let j = -1; for (let k = 5; k < 30; k++) if (B.l[i - k] === l[i - k]) { j = i - k; break; } return j > 0 && m.hist[i] > m.hist[j] && m.hist[i] < 0; }, i => xDn(m.macd, m.signal, i)); });

  // ───────────── MOMENTUM / OSCILLATOR ─────────────
  add('rsi_50', 'RSI 50 Momentum', 'Momentum traders', 'Momentum', 'Long while RSI(14) > 55, short while < 45, hold previous state in between.',
    {}, B => { const r = T.rsi(B.c, 14); return regime(B.c.length, i => r[i] > 55 ? 1 : r[i] < 45 ? -1 : null); });
  add('roc_momentum', 'Rate of Change Momentum (12-1)', 'Jegadeesh & Titman (1993) momentum anomaly', 'Momentum', 'Long when the 12-month return (skipping the last month) is positive and above 10%; flat otherwise. Rebalanced monthly.',
    {}, B => { return regime(B.c.length, i => { if (i < 252) return null; if (i % 21 !== 0) return null; const r = B.c[i - 21] / B.c[i - 252] - 1; return r > 0.1 ? 1 : 0; }); });
  add('dual_momentum', 'Absolute Momentum (Dual Momentum leg)', 'Gary Antonacci, "Dual Momentum Investing"', 'Momentum', 'Antonacci\'s absolute-momentum rule: hold when the 12-month return beats the risk-free rate (~6.5%/yr in India), else cash. Monthly check.',
    { rf: 6.5 }, (B, p) => regime(B.c.length, i => (i < 252 || i % 21 !== 0) ? null : (B.c[i] / B.c[i - 252] - 1) * 100 > p.rf ? 1 : 0));
  add('ao_zero', 'Awesome Oscillator Zero Cross', 'Bill Williams', 'Momentum', 'Long when AO crosses above zero, short when below.',
    {}, B => { const a = T.ao(B); return regime(B.c.length, i => ok(a[i]) ? (a[i] > 0 ? 1 : -1) : null); });
  add('ao_saucer', 'Awesome Oscillator Saucer', 'Bill Williams', 'Momentum', 'AO above zero, two red bars (falling) followed by a green bar → buy. Exit on AO cross below zero.',
    {}, B => { const a = T.ao(B); return machine(B.c.length, i => ok(a[i - 3]) && a[i] > 0 && a[i - 1] < a[i - 2] && a[i - 2] < a[i - 3] && a[i] > a[i - 1], i => a[i] < 0); });
  add('cci_trend', 'CCI +100 Trend (Woodie\'s CCI)', 'Ken Wood (Woodie\'s CCI Club)', 'Momentum', 'Long when CCI(14) crosses above +100, exit when it drops below 0. Short below −100, cover above 0.',
    {}, B => { const c = T.cci(B, 14); return machine(B.c.length, i => xUp(c, 100, i), i => c[i] < 0, i => xDn(c, -100, i), i => c[i] > 0); });
  add('macd_hist', 'MACD Histogram Reversal', 'Thomas Aspray', 'Momentum', 'Long when the MACD histogram turns up from below zero, exit when it turns down above zero.',
    {}, B => { const h = T.macdFull(B.c).hist; return machine(B.c.length, i => ok(h[i - 2]) && h[i] < 0 && h[i] > h[i - 1] && h[i - 1] < h[i - 2], i => h[i] > 0 && h[i] < h[i - 1]); });
  add('ppo_cross', 'PPO Signal Cross', 'Percentage Price Oscillator', 'Momentum', 'Long when PPO is above its 9-EMA signal and above zero; flat otherwise.',
    {}, B => { const p = T.ppo(B.c), s = T.ema(p, 9); return regime(B.c.length, i => ok(s[i]) ? (p[i] > s[i] && p[i] > 0 ? 1 : 0) : null); });
  add('tsi_cross', 'True Strength Index Cross', 'William Blau', 'Momentum', 'Long when TSI crosses above its 7-EMA signal, exit when it crosses below.',
    {}, B => { const t = T.tsi(B.c), s = T.ema(t, 7); return regime(B.c.length, i => ok(s[i]) ? (t[i] > s[i] ? 1 : -1) : null); });
  add('rvi_cross', 'Relative Vigor Index Cross', 'John Ehlers', 'Momentum', 'Long when RVI crosses above its signal line, short when below.',
    {}, B => { const r = T.rvi(B); return regime(B.c.length, i => ok(r.signal[i]) ? (r.rvi[i] > r.signal[i] ? 1 : -1) : null); });
  add('coppock', 'Coppock Curve Buy Signal', 'Edwin Coppock (Barron\'s, 1962)', 'Momentum', 'Designed for long-term bottoms: buy when the Coppock Curve turns up from below zero; exit when it turns down from above zero.',
    {}, B => { const c = T.coppock(B.c); return machine(B.c.length, i => ok(c[i - 1]) && c[i] < 0 && c[i] > c[i - 1], i => c[i] > 0 && c[i] < c[i - 1]); });
  add('elder_ray', 'Elder-Ray Bull/Bear Power', 'Dr. Alexander Elder', 'Momentum', '13 EMA rising, Bear Power negative but rising → buy. Exit when Bull Power falls below zero.',
    {}, B => { const e = T.ema(B.c, 13), r = T.elderRay(B, 13); return machine(B.c.length, i => ok(e[i - 1]) && e[i] > e[i - 1] && r.bear[i] < 0 && r.bear[i] > r.bear[i - 1], i => r.bull[i] < 0); });
  add('elder_triple', 'Elder Triple Screen', 'Dr. Alexander Elder, "Trading for a Living"', 'Momentum',
    'Screen 1 (tide): weekly trend = 26-week EMA (130-day) rising. Screen 2 (wave): daily Force Index(2) turns negative = pullback. Screen 3: buy. Exit when Force Index(13) turns negative and tide turns down.',
    {}, B => { const tide = T.ema(B.c, 130), f2 = T.forceIndex(B, 2), f13 = T.forceIndex(B, 13); return machine(B.c.length, i => ok(tide[i - 5]) && tide[i] > tide[i - 5] && f2[i] < 0, i => tide[i] < tide[i - 5] || (f13[i] < 0 && B.c[i] < tide[i])); });
  add('force_index', 'Force Index Trend', 'Dr. Alexander Elder', 'Momentum', 'Long when the 13-period Force Index is above zero, short when below.',
    {}, B => { const f = T.forceIndex(B, 13); return regime(B.c.length, i => ok(f[i]) ? (f[i] > 0 ? 1 : -1) : null); });
  add('momentum_10', 'Momentum (10) Zero Cross', 'Classic', 'Momentum', 'Long when the 10-day price momentum crosses above zero, short below.',
    {}, B => { const m = T.momentum(B.c, 10); return regime(B.c.length, i => ok(m[i]) ? (m[i] > 0 ? 1 : -1) : null); });
  add('stoch_trend', 'Stochastic Pop', 'Jake Bernstein / David Steckler', 'Momentum', 'Buy when %K pops above 80 (strong momentum) with ADX > 20; exit when %K falls below 50.',
    {}, B => { const s = T.stoch(B, 14, 3), a = T.adx(B); return machine(B.c.length, i => xUp(s.k, 80, i) && a.adx[i] > 20, i => s.k[i] < 50); });
  add('mass_reversal', 'Mass Index Reversal Bulge', 'Donald Dorsey', 'Momentum', 'Reversal bulge: Mass Index rises above 27 then falls below 26.5 → trade in the direction of the 9 EMA slope. Hold 10 days.',
    {}, B => { const m = T.massIndex(B), e = T.ema(B.c, 9); let armed = false; return holdN(B.c.length, i => { if (m[i] > 27) armed = true; if (armed && m[i] < 26.5) { armed = false; return e[i] > e[i - 1]; } return false; }, 10); });
  add('kst_zero', 'KST Above Zero', 'Martin Pring', 'Momentum', 'Long while KST is above both zero and its signal line; flat otherwise.',
    {}, B => { const k = T.kst(B.c); return regime(B.c.length, i => ok(k.signal[i]) ? (k.kst[i] > 0 && k.kst[i] > k.signal[i] ? 1 : 0) : null); });
  add('rel_strength_nifty', 'Relative Strength vs Market (self-normalised)', 'O\'Neil RS Rating idea', 'Momentum', 'Long when the 6-month ROC is in the top 30% of its own 3-year range (proxy for strong relative strength); exit below 50%.',
    {}, B => { const r = T.roc(B.c, 126), hi = T.highest(r, 756), lo = T.lowest(r, 756); return machine(B.c.length, i => ok(hi[i]) && (r[i] - lo[i]) / (hi[i] - lo[i]) > 0.7, i => (r[i] - lo[i]) / (hi[i] - lo[i]) < 0.5); });

  // ───────────── VOLUME ─────────────
  add('obv_trend', 'OBV Trend Confirmation', 'Joseph Granville', 'Volume', 'Granville: "volume precedes price". Long when OBV is above its 20-EMA and price is above its 20-EMA; exit when either fails.',
    {}, B => { const o = T.obv(B), oe = T.ema(o, 20), pe = T.ema(B.c, 20); return machine(B.c.length, i => o[i] > oe[i] && B.c[i] > pe[i], i => o[i] < oe[i] || B.c[i] < pe[i]); });
  add('obv_breakout', 'OBV Breakout Leads Price', 'Joseph Granville', 'Volume', 'Buy when OBV makes a new 50-day high before price does (price still below its 50-day high). Exit when OBV falls below its 50-EMA.',
    {}, B => { const o = T.obv(B), oh = T.shift(T.highest(o, 50)), ph = T.highest(B.h, 50), oe = T.ema(o, 50); return machine(B.c.length, i => o[i] > oh[i] && B.h[i] < ph[i], i => o[i] < oe[i]); });
  add('cmf', 'Chaikin Money Flow', 'Marc Chaikin', 'Volume', 'Long when CMF(20) > +0.05 (accumulation), exit when < −0.05 (distribution).',
    {}, B => { const c = T.cmf(B, 20); return machine(B.c.length, i => c[i] > 0.05, i => c[i] < -0.05); });
  add('chaikin_osc', 'Chaikin Oscillator Cross', 'Marc Chaikin', 'Volume', 'Long when the Chaikin Oscillator crosses above zero with price above the 50 SMA; exit on the cross below zero.',
    {}, B => { const c = T.chaikinOsc(B), s = T.sma(B.c, 50); return machine(B.c.length, i => xUp(c, 0, i) && B.c[i] > s[i], i => xDn(c, 0, i)); });
  add('adl_trend', 'Accumulation/Distribution Trend', 'Marc Chaikin', 'Volume', 'Long when the A/D line is above its 50-day average, flat otherwise.',
    {}, B => { const a = T.adl(B), s = T.sma(a, 50); return regime(B.c.length, i => ok(s[i]) ? (a[i] > s[i] ? 1 : 0) : null); });
  add('klinger', 'Klinger Volume Oscillator', 'Stephen Klinger', 'Volume', 'Long when the KVO crosses above its 13-EMA signal and price is above the 100 SMA; exit on the cross below.',
    {}, B => { const k = T.klinger(B), s = T.sma(B.c, 100); return machine(B.c.length, i => xUp(k.kvo, k.signal, i) && B.c[i] > s[i], i => xDn(k.kvo, k.signal, i)); });
  add('eom', 'Ease of Movement', 'Richard W. Arms Jr.', 'Volume', 'Long when the 14-day EMV crosses above zero, exit below zero.',
    {}, B => { const e = T.eom(B, 14); return regime(B.c.length, i => ok(e[i]) ? (e[i] > 0 ? 1 : 0) : null); });
  add('volume_spike', 'Volume Spike Breakout', 'Tape readers / Richard Wyckoff', 'Volume', 'Up day on volume > 2.5× its 50-day average that closes in the top third of the range → buy. Exit after 10 days or on a close below the spike bar\'s low.',
    {}, B => { const v = T.sma(B.v, 50); let lo = 0, cnt = 0; return machine(B.c.length, i => { const e = ok(v[i]) && B.v[i] > 2.5 * v[i] && B.c[i] > B.o[i] && B.c[i] > B.h[i] - range(B, i) / 3; if (e) { lo = B.l[i]; cnt = 0; } return e; }, i => ++cnt > 10 || B.c[i] < lo); });
  add('wyckoff_spring', 'Wyckoff Spring', 'Richard D. Wyckoff', 'Volume', 'Price undercuts a 40-day trading-range low on higher volume, then closes back inside the range → buy (spring). Exit at the range top or on a new low.',
    {}, B => { const l = T.shift(T.lowest(B.l, 40)), h = T.shift(T.highest(B.h, 40)), v = T.sma(B.v, 20); let top = 0, stop = 0; return machine(B.c.length, i => { const e = ok(l[i], v[i]) && B.l[i] < l[i] && B.c[i] > l[i] && B.v[i] > v[i] && (h[i] - l[i]) / l[i] < 0.25; if (e) { top = h[i]; stop = B.l[i]; } return e; }, i => B.h[i] >= top || B.c[i] < stop); });
  add('vpt', 'Volume-Price Trend', 'Classic', 'Volume', 'VPT = cumulative volume × % change. Long when VPT is above its 20-EMA, short below.',
    {}, B => { let v = 0; const vpt = B.c.map((c, i) => (i ? (v += B.v[i] * (c / B.c[i - 1] - 1)) : 0)); const e = T.ema(vpt, 20); return regime(B.c.length, i => ok(e[i]) ? (vpt[i] > e[i] ? 1 : -1) : null); });
  add('vwap_trend', 'Rolling VWAP Trend', 'Institutional benchmark', 'Volume', 'Long while price is above the 50-day rolling VWAP, flat below.',
    {}, B => { const v = T.vwapRolling(B, 50); return regime(B.c.length, i => ok(v[i]) ? (B.c[i] > v[i] ? 1 : 0) : null); });

  // ───────────── VOLATILITY ─────────────
  add('atr_trailing', 'ATR Trailing Stop Trend', 'J. Welles Wilder Jr. (Volatility System)', 'Volatility', 'Wilder\'s Volatility System: stop-and-reverse with a trailing stop 3 × ATR(7) from the extreme close.',
    {}, B => { const a = T.atr(B, 7); let side = 1, ext = B.c[0]; return regime(B.c.length, i => { if (!ok(a[i])) return null; if (side === 1) { ext = Math.max(ext, B.c[i]); if (B.c[i] < ext - 3 * a[i]) { side = -1; ext = B.c[i]; } } else { ext = Math.min(ext, B.c[i]); if (B.c[i] > ext + 3 * a[i]) { side = 1; ext = B.c[i]; } } return side; }); });
  add('chandelier', 'Chandelier Exit Trend', 'Chuck LeBeau', 'Volatility', 'Long when close > 22-day high − 3 ATR (chandelier long stop) and above the 50 EMA; exit on a close below the chandelier.',
    {}, B => { const c = T.chandelier(B, 22, 3), e = T.ema(B.c, 50); return machine(B.c.length, i => B.c[i] > c.long[i] && xUp(B.c, e, i), i => B.c[i] < c.long[i]); });
  add('bb_squeeze', 'Bollinger Squeeze', 'John Bollinger, "Bollinger on Bollinger Bands"', 'Volatility', 'When Bandwidth hits a 6-month low (the "squeeze"), trade the subsequent breakout of the bands. Exit at the middle band.',
    {}, B => { const b = T.bollinger(B.c, 20, 2), lo = T.lowest(b.bw, 126); let armed = 0; return machine(B.c.length, i => { if (ok(lo[i]) && b.bw[i] <= lo[i] * 1.05) armed = 10; else armed--; return armed > 0 && B.c[i] > b.up[i]; }, i => B.c[i] < b.mid[i], i => armed > 0 && B.c[i] < b.lo[i], i => B.c[i] > b.mid[i]); });
  add('low_vol_filter', 'Low Volatility Regime', 'Low-volatility anomaly (Haugen & Baker)', 'Volatility', 'Hold the stock only when its 20-day historical volatility is below its 1-year median and price is above the 100 SMA.',
    {}, B => { const hv = T.histVol(B.c, 20), s = T.sma(B.c, 100), m = T.sma(hv, 252); return regime(B.c.length, i => ok(m[i], s[i]) ? (hv[i] < m[i] && B.c[i] > s[i] ? 1 : 0) : null); });
  add('vix_style', 'Volatility Spike Buy', 'Contrarian "buy when there\'s blood in the streets" – Baron Rothschild', 'Volatility', 'Buy when 10-day historical volatility is > 2× its 1-year average (panic) and price is down > 10% from its 20-day high; hold 20 days.',
    {}, B => { const hv = T.histVol(B.c, 10), m = T.sma(hv, 252), h = T.highest(B.h, 20); return holdN(B.c.length, i => ok(m[i]) && hv[i] > 2 * m[i] && B.c[i] < 0.9 * h[i], 20); });
  add('chop_filter', 'Choppiness-Filtered EMA Trend', 'E.W. Dreiss', 'Volatility', 'Trade the 20/50 EMA cross only when the Choppiness Index < 50 (trending market); flat when choppy.',
    {}, B => { const c = T.chop(B, 14), a = T.ema(B.c, 20), b = T.ema(B.c, 50); return regime(B.c.length, i => !ok(c[i], b[i]) ? null : c[i] > 55 ? 0 : a[i] > b[i] ? 1 : -1); });
  add('kaufman_er', 'Efficiency Ratio Trend', 'Perry Kaufman', 'Volatility', 'Long when the 20-day efficiency ratio > 0.3 and price rose over the period; flat otherwise.',
    {}, B => { const e = T.efficiency(B.c, 20); return regime(B.c.length, i => ok(e[i]) ? (e[i] > 0.3 && B.c[i] > B.c[i - 20] ? 1 : e[i] < 0.15 ? 0 : null) : null); });
  add('ulcer_filter', 'Ulcer Index Risk Filter', 'Peter Martin', 'Volatility', 'Hold above the 50 SMA only while the Ulcer Index (drawdown pain) is below 5; cash otherwise.',
    {}, B => { const u = T.ulcer(B.c, 14), s = T.sma(B.c, 50); return regime(B.c.length, i => ok(u[i], s[i]) ? (u[i] < 5 && B.c[i] > s[i] ? 1 : 0) : null); });

  // ───────────── CANDLESTICK / PRICE ACTION ─────────────
  add('bull_engulf', 'Bullish Engulfing', 'Steve Nison, "Japanese Candlestick Charting Techniques"', 'Candlestick', 'Bullish candle whose body engulfs the prior bearish body, after a 5-day decline → buy, hold 5 days.',
    {}, B => holdN(B.c.length, i => i > 5 && bear(B, i - 1) && bull(B, i) && B.c[i] > B.o[i - 1] && B.o[i] < B.c[i - 1] && B.c[i - 1] < B.c[i - 5], 5));
  add('hammer', 'Hammer Reversal', 'Steve Nison', 'Candlestick', 'Lower wick ≥ 2× body, small upper wick, at a 10-day low → buy, hold 5 days.',
    {}, B => { const l = T.lowest(B.l, 10); return holdN(B.c.length, i => { const b = body(B, i), lw = Math.min(B.o[i], B.c[i]) - B.l[i], uw = B.h[i] - Math.max(B.o[i], B.c[i]); return ok(l[i]) && B.l[i] <= l[i] && lw >= 2 * b && uw <= b && range(B, i) > 0; }, 5); });
  add('morning_star', 'Morning Star', 'Steve Nison', 'Candlestick', 'Three-bar reversal: long bearish candle, small-bodied star, then a bullish candle closing above the midpoint of the first → buy, hold 7 days.',
    {}, B => holdN(B.c.length, i => i > 2 && bear(B, i - 2) && body(B, i - 2) > 0.6 * range(B, i - 2) && body(B, i - 1) < 0.3 * body(B, i - 2) && bull(B, i) && B.c[i] > (B.o[i - 2] + B.c[i - 2]) / 2, 7));
  add('three_soldiers', 'Three White Soldiers', 'Japanese candlestick (Munehisa Homma)', 'Candlestick', 'Three consecutive long bullish candles each closing higher near its high → buy, hold 10 days.',
    {}, B => holdN(B.c.length, i => i > 2 && [0, 1, 2].every(k => bull(B, i - k) && body(B, i - k) > 0.6 * range(B, i - k) && (k === 2 || B.c[i - k] > B.c[i - k - 1])), 10));
  add('piercing', 'Piercing Line', 'Steve Nison', 'Candlestick', 'After a bearish candle, price opens below its low and closes above its midpoint → buy, hold 5 days.',
    {}, B => holdN(B.c.length, i => i > 0 && bear(B, i - 1) && B.o[i] < B.l[i - 1] && B.c[i] > (B.o[i - 1] + B.c[i - 1]) / 2 && B.c[i] < B.o[i - 1], 5));
  add('pin_bar', 'Pin Bar at Support', 'Price action (Martin Pring / Nial Fuller)', 'Candlestick', 'Bullish pin bar (lower wick > 66% of range) touching the 50 EMA in an uptrend → buy, hold 7 days.',
    {}, B => { const e = T.ema(B.c, 50), e2 = T.ema(B.c, 200); return holdN(B.c.length, i => { const lw = Math.min(B.o[i], B.c[i]) - B.l[i]; return ok(e2[i]) && range(B, i) > 0 && lw > 0.66 * range(B, i) && B.l[i] <= e[i] && B.c[i] > e[i] && e[i] > e2[i]; }, 7); });
  add('doji_reversal', 'Dragonfly Doji Reversal', 'Japanese candlestick', 'Candlestick', 'Doji (body < 10% of range) with a long lower shadow at a 20-day low → buy on next bar, hold 5 days.',
    {}, B => { const l = T.lowest(B.l, 20); return holdN(B.c.length, i => i > 0 && ok(l[i - 1]) && body(B, i - 1) < 0.1 * range(B, i - 1) && B.l[i - 1] <= l[i - 1] && B.c[i] > B.h[i - 1], 5); });
  add('harami', 'Bullish Harami', 'Steve Nison', 'Candlestick', 'Small bullish candle contained within a large prior bearish body, at a 10-day low → buy, hold 5 days.',
    {}, B => { const l = T.lowest(B.l, 10); return holdN(B.c.length, i => i > 0 && ok(l[i - 1]) && bear(B, i - 1) && bull(B, i) && B.o[i] > B.c[i - 1] && B.c[i] < B.o[i - 1] && B.l[i - 1] <= l[i - 1], 5); });
  add('outside_reversal', 'Key Outside Reversal Day', 'Classic chartist (Edwards & Magee)', 'Candlestick', 'Today makes a lower low than yesterday but closes above yesterday\'s high → buy, hold 5 days.',
    {}, B => holdN(B.c.length, i => i > 0 && B.l[i] < B.l[i - 1] && B.c[i] > B.h[i - 1], 5));
  add('tweezer_bottom', 'Tweezer Bottom', 'Japanese candlestick', 'Candlestick', 'Two consecutive bars with near-identical lows (within 0.2%) at a 20-day low, second bar bullish → buy, hold 5 days.',
    {}, B => { const l = T.lowest(B.l, 20); return holdN(B.c.length, i => i > 0 && ok(l[i]) && Math.abs(B.l[i] - B.l[i - 1]) / B.l[i] < 0.002 && Math.min(B.l[i], B.l[i - 1]) <= l[i] && bull(B, i), 5); });
  add('marubozu', 'Bullish Marubozu Momentum', 'Japanese candlestick', 'Candlestick', 'Full-bodied bullish candle (body > 90% of range, range > 1.5 ATR) → buy, hold 5 days.',
    {}, B => { const a = T.atr(B, 14); return holdN(B.c.length, i => ok(a[i]) && bull(B, i) && body(B, i) > 0.9 * range(B, i) && range(B, i) > 1.5 * a[i], 5); });
  add('higher_low_ma', '2-Bar Higher-Low Pullback', 'Al Brooks price-action ("H2")', 'Candlestick', 'In an uptrend (20 EMA > 50 EMA), the second attempt to resume the trend after a pullback (H2: high breaks prior high twice) → buy, hold 5 days.',
    {}, B => { const a = T.ema(B.c, 20), b = T.ema(B.c, 50); let pb = false, legs = 0; return holdN(B.c.length, i => { if (!ok(b[i]) || a[i] < b[i]) { pb = false; legs = 0; return false; } if (B.c[i] < a[i]) { pb = true; legs = 0; return false; } if (pb && B.h[i] > B.h[i - 1]) { legs++; if (legs === 2) { pb = false; legs = 0; return true; } } return false; }, 5); });

  // ───────────── SEASONALITY / CALENDAR ─────────────
  add('turn_of_month', 'Turn-of-the-Month Effect', 'Ariel (1987), Lakonishok & Smidt', 'Seasonal', 'Hold the stock from the last 2 trading days of the month to the 3rd trading day of the next month (salary/fund inflows). Cash otherwise.',
    {}, B => { const n = B.c.length, pos = new Array(n).fill(0); for (let i = 0; i < n - 1; i++) { const m = B.d[i].slice(0, 7); let left = 0; for (let k = i + 1; k < n && B.d[k].slice(0, 7) === m; k++) left++; let into = 0; for (let k = i; k >= 0 && B.d[k].slice(0, 7) === m; k--) into++; pos[i] = left <= 1 || into <= 2 ? 1 : 0; } return pos; });
  add('turnaround_tuesday', 'Turnaround Tuesday', 'Larry Connors / Toby Crabel', 'Seasonal', 'If Monday closes down (and below Friday by > 1%), buy at the Tuesday open; exit at the Tuesday close (hold 1 bar).',
    {}, B => holdN(B.c.length, i => i > 0 && dow(B, i) === 1 && B.c[i] < B.c[i - 1] * 0.99, 1));
  add('halloween', 'Sell in May (Halloween Indicator)', 'Bouman & Jacobsen (2002)', 'Seasonal', 'Hold from 1 November to 30 April; stay in cash May–October.',
    {}, B => B.c.map((_, i) => { const m = month(B, i); return m >= 11 || m <= 4 ? 1 : 0; }));
  add('pre_holiday_dip', 'Week-Start Weakness Buy', 'Weekend effect (French 1980)', 'Seasonal', 'Buy at the close of a down Friday, sell after Monday/next session.',
    {}, B => holdN(B.c.length, i => i > 0 && dow(B, i) === 5 && B.c[i] < B.c[i - 1], 1));
  add('diwali_budget', 'Diwali-to-Budget Seasonal (India)', 'Indian market folklore (Muhurat → Union Budget rally)', 'Seasonal', 'Long from 15 October to 31 January each year (festive season through Budget), cash otherwise.',
    {}, B => B.c.map((_, i) => { const m = month(B, i), d = day(B, i); return (m === 10 && d >= 15) || m === 11 || m === 12 || m === 1 ? 1 : 0; }));
  add('month_end_mom', 'Monthly Momentum Rebalance', 'Classic monthly time-series momentum (Moskowitz, Ooi, Pedersen)', 'Seasonal', 'At each month-end, hold next month if the past 3-month return is positive, else cash.',
    {}, B => regime(B.c.length, i => { if (i < 63 || i + 1 >= B.c.length || B.d[i].slice(0, 7) === B.d[i + 1].slice(0, 7)) return null; return B.c[i] > B.c[i - 63] ? 1 : 0; }));

  // ───────────── FAMOUS TRADER / COMPOSITE SYSTEMS ─────────────
  add('buffett_bnh', 'Buy & Hold (Benchmark)', 'Warren Buffett / Jack Bogle philosophy', 'Benchmark', 'Buy on the first day and never sell. Every other strategy should be compared with this.',
    {}, B => B.c.map(() => 1));
  add('gann_hilo', 'Gann HiLo Activator', 'W.D. Gann (Robert Krausz version)', 'Famous Systems', 'Long when close > 3-bar SMA of highs (shifted), short when close < 3-bar SMA of lows.',
    {}, B => { const h = T.shift(T.sma(B.h, 3)), l = T.shift(T.sma(B.l, 3)); return regime(B.c.length, i => B.c[i] > h[i] ? 1 : B.c[i] < l[i] ? -1 : null); });
  add('gann_swing', 'Gann Swing Chart (3-day)', 'W.D. Gann', 'Famous Systems', 'Gann 3-day swing: trend turns up after 3 consecutive higher highs; turns down after 3 consecutive lower lows.',
    {}, B => regime(B.c.length, i => i < 3 ? null : [0, 1, 2].every(k => B.h[i - k] > B.h[i - k - 1]) ? 1 : [0, 1, 2].every(k => B.l[i - k] < B.l[i - k - 1]) ? -1 : null));
  add('jones_200', 'Paul Tudor Jones 200-Day Rule', 'Paul Tudor Jones', 'Famous Systems', '"My metric for everything I look at is the 200-day moving average." Long above it; exit below it with a 2% buffer to reduce whipsaws.',
    {}, B => { const s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i]) && B.c[i] > s[i] * 1.02, i => B.c[i] < s[i] * 0.98); });
  add('druck_trend', 'Druckenmiller Momentum + Trend', 'Stanley Druckenmiller style', 'Famous Systems', 'Go with strong trends with conviction: long when 6-month ROC > 20% and price > 50 SMA > 200 SMA; exit when ROC < 0 or price < 200 SMA.',
    {}, B => { const r = T.roc(B.c, 126), s50 = T.sma(B.c, 50), s200 = T.sma(B.c, 200); return machine(B.c.length, i => ok(s200[i]) && r[i] > 20 && B.c[i] > s50[i] && s50[i] > s200[i], i => r[i] < 0 || B.c[i] < s200[i]); });
  add('rakesh_jhunjhunwala', 'Jhunjhunwala Long-Term Trend Investor', 'Rakesh Jhunjhunwala style (approximation)', 'Famous Systems', 'Long-term conviction holding: buy when price is above its 200-day SMA after a 20%+ correction from its 1-year high (buying quality on dips), exit only on a close 25% below the entry-time 1-year high.',
    {}, B => { const s = T.sma(B.c, 200), h = T.highest(B.h, 252), l60 = T.lowest(B.l, 60); let stop = 0; return machine(B.c.length, i => { const e = ok(h[i], s[i], l60[i]) && l60[i] < 0.8 * h[i] && xUp(B.c, s, i); if (e) stop = 0.75 * h[i]; return e; }, i => B.c[i] < stop); });
  add('lynch_garp_trend', 'Peter Lynch "Tenbagger" Trend Hold', 'Peter Lynch style (technical approximation)', 'Famous Systems', 'Buy after a 6-month base breakout (new 126-day high) and hold for the long term – exit only when price closes below the 200-day SMA ("let your winners run").',
    {}, B => { const h = T.shift(T.highest(B.h, 126)), s = T.sma(B.c, 200); return machine(B.c.length, i => ok(s[i]) && B.c[i] > h[i], i => B.c[i] < s[i]); });
  add('raschke_first_cross', 'Raschke First Cross (3-10 Oscillator)', 'Linda Raschke', 'Famous Systems', 'Raschke\'s 3/10 oscillator (3 SMA − 10 SMA with a 16 SMA signal): buy the first cross of the fast line above the slow line after a pullback in a trend (price > 50 EMA).',
    {}, B => { const s10 = T.sma(B.c, 10), o = T.sma(B.c, 3).map((x, i) => x - s10[i]); const s = T.sma(o, 16), e = T.ema(B.c, 50); return machine(B.c.length, i => xUp(o, s, i) && B.c[i] > e[i], i => xDn(o, s, i)); });
  add('williams_ultimate', 'Larry Williams %R + Trend', 'Larry Williams, "Long-Term Secrets to Short-Term Trading"', 'Famous Systems', 'Buy when %R(10) < −90 while the 100 SMA is rising; exit when %R > −20.',
    {}, B => { const w = T.willr(B, 10), s = T.sma(B.c, 100); return machine(B.c.length, i => ok(s[i - 5]) && w[i] < -90 && s[i] > s[i - 5], i => w[i] > -20); });
  add('dennis_atr_pyramid', 'Turtle with 2N Stop', 'Richard Dennis (Turtle money-management)', 'Famous Systems', '20-day breakout entry, exit on either a 10-day low or a 2N (2 × ATR20) stop from entry – the full Turtle risk rule.',
    {}, B => { const h = T.shift(T.highest(B.h, 20)), l = T.shift(T.lowest(B.l, 10)), a = T.atr(B, 20); let stop = 0; return machine(B.c.length, i => { const e = B.c[i] > h[i]; if (e) stop = B.c[i] - 2 * a[i]; return e; }, i => B.c[i] < l[i] || B.c[i] < stop); });
  add('oneil_ftd', 'O\'Neil Follow-Through Day', 'William J. O\'Neil', 'Famous Systems', 'After a 10%+ correction, a day 4+ days after the low that rises > 1.5% on higher volume confirms a new uptrend → buy. Exit on close below the 50 SMA.',
    {}, B => { const h = T.highest(B.h, 60), s = T.sma(B.c, 50); return machine(B.c.length, i => { if (!ok(h[i], s[i])) return false; let lowI = i; for (let k = 1; k < 25; k++) if (B.l[i - k] < B.l[lowI]) lowI = i - k; const days = i - lowI; return B.l[lowI] < 0.9 * h[i] && days >= 4 && days <= 15 && B.c[i] > B.c[i - 1] * 1.015 && B.v[i] > B.v[i - 1]; }, i => B.c[i] < s[i]); });
  add('kirkpatrick_rs', 'Bollinger-Trend Hybrid (BB + 200)', 'John Bollinger\'s "Method I"', 'Famous Systems', 'Bollinger\'s Method I: after a squeeze, go with the band break, but only in the direction of the 200 SMA trend. Exit on the parabolic SAR flip.',
    {}, B => { const b = T.bollinger(B.c, 20, 2), s = T.sma(B.c, 200), ps = T.psar(B); return machine(B.c.length, i => ok(s[i]) && B.c[i] > b.up[i] && B.c[i] > s[i], i => B.c[i] < ps[i]); });
  add('tharp_r', 'Van Tharp Random Entry + Trailing Stop', 'Van K. Tharp, "Trade Your Way to Financial Freedom"', 'Famous Systems', 'Tharp\'s famous experiment: enter on a coin flip (seeded, deterministic) and use a 3 × ATR trailing stop. Shows that exits and position sizing matter more than entries.',
    { seed: 42 }, (B, p) => { let s = p.seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const a = T.atr(B, 10); let stop = 0, hi = 0;
      return machine(B.c.length, i => { const e = ok(a[i]) && rnd() < 0.1; if (e) { hi = B.c[i]; stop = B.c[i] - 3 * a[i]; } return e; }, i => { hi = Math.max(hi, B.c[i]); stop = Math.max(stop, hi - 3 * a[i]); return B.c[i] < stop; }); });
  add('ma_ribbon_pullback', 'EMA Ribbon Pullback (8/21/55)', 'Fibonacci EMA traders', 'Famous Systems', 'Uptrend when 8 > 21 > 55 EMA. Buy when price pulls back to touch the 21 EMA and closes above it; exit when 8 EMA < 21 EMA.',
    {}, B => { const a = T.ema(B.c, 8), b = T.ema(B.c, 21), c = T.ema(B.c, 55); return machine(B.c.length, i => ok(c[i]) && a[i] > b[i] && b[i] > c[i] && B.l[i] <= b[i] && B.c[i] > b[i], i => a[i] < b[i]); });
  add('rsi_macd_combo', 'RSI + MACD Confluence', 'Retail favourite', 'Famous Systems', 'Long when MACD crosses above its signal while RSI(14) is between 40 and 60 (room to run); exit when RSI > 75 or MACD crosses down.',
    {}, B => { const m = T.macdFull(B.c), r = T.rsi(B.c, 14); return machine(B.c.length, i => xUp(m.macd, m.signal, i) && r[i] > 40 && r[i] < 60, i => r[i] > 75 || xDn(m.macd, m.signal, i)); });
  add('supertrend_ema', 'Supertrend + 200 EMA Filter', 'Indian intraday/swing community favourite', 'Famous Systems', 'Long when Supertrend(10,3) is bullish AND price is above the 200 EMA. Exit on Supertrend flip.',
    {}, B => { const s = T.supertrend(B, 10, 3), e = T.ema(B.c, 200); return machine(B.c.length, i => s.dir[i] === 1 && B.c[i] > e[i], i => s.dir[i] === -1); });
  add('bb_rsi', 'Bollinger + RSI Reversal', 'Swing-trading classic', 'Famous Systems', 'Buy when price closes below the lower Bollinger Band AND RSI(14) < 30; exit at the upper band or RSI > 70.',
    {}, B => { const b = T.bollinger(B.c, 20, 2), r = T.rsi(B.c, 14); return machine(B.c.length, i => B.c[i] < b.lo[i] && r[i] < 30, i => B.c[i] > b.up[i] || r[i] > 70); });
  add('adx_ema_pullback', 'ADX Trend + EMA Pullback', 'Wilder / Raschke hybrid', 'Famous Systems', 'ADX > 25 and price above 50 EMA: buy when RSI(3) dips below 20; exit when RSI(3) > 80.',
    {}, B => { const a = T.adx(B), e = T.ema(B.c, 50), r = T.rsi(B.c, 3); return machine(B.c.length, i => a.adx[i] > 25 && B.c[i] > e[i] && r[i] < 20, i => r[i] > 80); });
  add('stage_breakout_52', 'Stage-2 52-Week Breakout + Volume', 'Weinstein + O\'Neil hybrid', 'Famous Systems', 'Buy a new 52-week closing high on 2× average volume while above a rising 200 SMA; trailing exit at the 10-week (50-day) low.',
    {}, B => { const h = T.shift(T.highest(B.c, 252)), v = T.sma(B.v, 50), s = T.sma(B.c, 200), l = T.shift(T.lowest(B.l, 50)); return machine(B.c.length, i => ok(h[i], s[i - 20]) && B.c[i] > h[i] && B.v[i] > 2 * v[i] && s[i] > s[i - 20], i => B.c[i] < l[i]); });
  G.STRATEGIES = S;
  G.STRAT_HELPERS = { machine, regime, holdN, xUp, xDn, ok };
})(window);
