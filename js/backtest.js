// Backtest engine: signal on bar i close -> fill at bar i+1 open. Supports stop-loss, take-profit,
// ATR trailing stop, long-only (Indian cash market default), costs + slippage, integer share quantities.
(function (G) {
  const DEFAULTS = { capital: 1000000, allocPct: 100, longOnly: true, costPct: 0.12, slipPct: 0.05, stopPct: 0, targetPct: 0, trailAtr: 0, maxHold: 0, start: '', end: '' };

  function slice(B, start, end) {
    let a = 0, b = B.d.length - 1;
    if (start) while (a < B.d.length && B.d[a] < start) a++;
    if (end) while (b > 0 && B.d[b] > end) b--;
    return [a, b];
  }

  function run(B, pos, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const n = B.c.length, [a, b] = slice(B, o.start, o.end);
    const atr = o.trailAtr ? G.TA.atr(B, 14) : null;
    const cost = o.costPct / 100, slip = o.slipPct / 100;
    let cash = o.capital, qty = 0, side = 0, entryPx = 0, entryI = -1, entryCost = 0, stop = 0, target = 0, extreme = 0, blocked = 0;
    const equity = [], dates = [], trades = [];
    let barsIn = 0;
    const want = i => { let t = pos[i] || 0; if (o.longOnly && t < 0) t = 0; return t; };

    function close(i, px, reason) {
      const fill = side === 1 ? px * (1 - slip) : px * (1 + slip);
      const gross = side * qty * (fill - entryPx);
      const fees = qty * fill * cost;
      cash += side === 1 ? qty * fill - fees : -qty * fill - fees + 2 * qty * entryPx; // short: return margin
      const pnl = gross - fees - entryCost;
      trades.push({ side, qty, entryDate: B.d[entryI], entryPx, exitDate: B.d[i], exitPx: fill, pnl, ret: pnl / (qty * entryPx) * 100, bars: i - entryI, reason });
      qty = 0; side = 0;
    }
    function open(i, s, px) {
      const fill = s === 1 ? px * (1 + slip) : px * (1 - slip);
      const eq = cash;
      const q = Math.floor(eq * o.allocPct / 100 / (fill * (1 + cost)));
      if (q <= 0) return;
      const fees = q * fill * cost;
      cash -= q * fill + fees; // for shorts we lock the notional as margin
      qty = q; side = s; entryPx = fill; entryI = i; entryCost = fees; extreme = fill;
      stop = o.stopPct ? (s === 1 ? fill * (1 - o.stopPct / 100) : fill * (1 + o.stopPct / 100)) : 0;
      target = o.targetPct ? (s === 1 ? fill * (1 + o.targetPct / 100) : fill * (1 - o.targetPct / 100)) : 0;
    }

    for (let i = a; i <= b; i++) {
      // 1) act on yesterday's signal at today's open
      if (i > a) {
        const t = want(i - 1);
        if (blocked && t !== blocked) blocked = 0;
        if (side !== 0 && t !== side) close(i, B.o[i], 'signal');
        if (side === 0 && t !== 0 && t !== blocked) open(i, t, B.o[i]);
      }
      // 2) intrabar risk exits
      if (side !== 0) {
        if (o.trailAtr && atr[i - 1] === atr[i - 1]) {
          if (side === 1) { extreme = Math.max(extreme, B.h[i - 1] || extreme); const ts = extreme - o.trailAtr * atr[i - 1]; stop = Math.max(stop || 0, ts); }
          else { extreme = Math.min(extreme, B.l[i - 1] || extreme); const ts = extreme + o.trailAtr * atr[i - 1]; stop = stop ? Math.min(stop, ts) : ts; }
        }
        if (side === 1) {
          if (stop && B.l[i] <= stop) { close(i, Math.min(B.o[i], stop), 'stop'); blocked = 1; }
          else if (target && B.h[i] >= target) { close(i, Math.max(B.o[i], target), 'target'); blocked = 1; }
        } else if (side === -1) {
          if (stop && B.h[i] >= stop) { close(i, Math.max(B.o[i], stop), 'stop'); blocked = -1; }
          else if (target && B.l[i] <= target) { close(i, Math.min(B.o[i], target), 'target'); blocked = -1; }
        }
        if (side !== 0 && o.maxHold && i - entryI >= o.maxHold) { close(i, B.c[i], 'time'); blocked = side || blocked; }
      }
      if (side !== 0) barsIn++;
      const mtm = side === 1 ? qty * B.c[i] : side === -1 ? qty * (2 * entryPx - B.c[i]) : 0;
      equity.push(cash + mtm); dates.push(B.d[i]);
    }
    if (side !== 0) { close(b, B.c[b], 'end'); equity[equity.length - 1] = cash; }
    const m = metrics(equity, dates, trades, o.capital, B.c[a], B.c[b], barsIn);
    return { equity, dates, trades, metrics: m, range: [a, b] };
  }

  function metrics(eq, dates, trades, cap, p0, p1, barsIn) {
    const n = eq.length; if (n < 2) return {};
    const years = Math.max((new Date(dates[n - 1]) - new Date(dates[0])) / (365.25 * 864e5), 1 / 365);
    const rets = []; for (let i = 1; i < n; i++) rets.push(eq[i] / eq[i - 1] - 1);
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length);
    const dsd = Math.sqrt(rets.reduce((s, x) => s + (x < 0 ? x * x : 0), 0) / rets.length);
    let peak = eq[0], mdd = 0, ddStart = 0, longestDD = 0, curStart = 0;
    for (let i = 0; i < n; i++) { if (eq[i] >= peak) { peak = eq[i]; curStart = i; } const dd = eq[i] / peak - 1; if (dd < mdd) mdd = dd; longestDD = Math.max(longestDD, i - curStart); }
    const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl <= 0);
    const gw = wins.reduce((s, t) => s + t.pnl, 0), gl = -losses.reduce((s, t) => s + t.pnl, 0);
    let streak = 0, maxLoseStreak = 0; trades.forEach(t => { if (t.pnl <= 0) { streak++; maxLoseStreak = Math.max(maxLoseStreak, streak); } else streak = 0; });
    const total = eq[n - 1] / cap - 1, cagr = Math.pow(eq[n - 1] / cap, 1 / years) - 1;
    const bh = p1 / p0 - 1, bhCagr = Math.pow(p1 / p0, 1 / years) - 1;
    return {
      finalEquity: eq[n - 1], totalReturn: total * 100, cagr: cagr * 100, maxDD: mdd * 100,
      sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0, sortino: dsd ? (mean / dsd) * Math.sqrt(252) : 0,
      vol: sd * Math.sqrt(252) * 100, calmar: mdd ? cagr / -mdd : 0, trades: trades.length,
      winRate: trades.length ? wins.length / trades.length * 100 : 0, profitFactor: gl ? gw / gl : (gw ? 99 : 0),
      avgWin: wins.length ? wins.reduce((s, t) => s + t.ret, 0) / wins.length : 0, avgLoss: losses.length ? losses.reduce((s, t) => s + t.ret, 0) / losses.length : 0,
      expectancy: trades.length ? trades.reduce((s, t) => s + t.ret, 0) / trades.length : 0,
      avgBars: trades.length ? trades.reduce((s, t) => s + t.bars, 0) / trades.length : 0,
      best: trades.length ? Math.max(...trades.map(t => t.ret)) : 0, worst: trades.length ? Math.min(...trades.map(t => t.ret)) : 0,
      exposure: barsIn / n * 100, maxLoseStreak, longestDDdays: longestDD, years,
      bhReturn: bh * 100, bhCagr: bhCagr * 100, alpha: (cagr - bhCagr) * 100,
    };
  }

  function strategyPositions(strat, B, params) {
    const p = Object.assign({}, strat.params, params || {});
    const pos = strat.fn(B, p);
    return pos.map(x => (x === 1 || x === -1 ? x : 0));
  }

  G.BT = { run, metrics, strategyPositions, DEFAULTS };
})(window);
