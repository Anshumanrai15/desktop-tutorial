// Technical indicator library. Every function takes arrays and returns arrays of the
// same length (NaN during warm-up). Bars object B = {o,h,l,c,v,d}.
(function (G) {
  const N = NaN, isn = x => x !== x;
  const nz = (x, d = 0) => (x !== x || x == null ? d : x);
  const arr = n => new Array(n).fill(N);

  function sma(s, p) { const r = arr(s.length); let sum = 0, cnt = 0;
    for (let i = 0; i < s.length; i++) { const x = s[i];
      if (isn(x)) { sum = 0; cnt = 0; continue; }
      sum += x; cnt++; if (cnt > p) { sum -= s[i - p]; cnt = p; }
      if (cnt === p) r[i] = sum / p; } return r; }
  function ema(s, p, alpha) { const r = arr(s.length), a = alpha || 2 / (p + 1); let prev = N, seed = 0, cnt = 0;
    for (let i = 0; i < s.length; i++) { const x = s[i]; if (isn(x)) continue;
      if (isn(prev)) { seed += x; cnt++; if (cnt === p) { prev = seed / p; r[i] = prev; } }
      else { prev = a * x + (1 - a) * prev; r[i] = prev; } } return r; }
  const rma = (s, p) => ema(s, p, 1 / p); // Wilder smoothing
  function wma(s, p) { const r = arr(s.length), den = p * (p + 1) / 2;
    for (let i = p - 1; i < s.length; i++) { let t = 0, bad = false;
      for (let k = 0; k < p; k++) { const x = s[i - k]; if (isn(x)) { bad = true; break; } t += x * (p - k); }
      if (!bad) r[i] = t / den; } return r; }
  const hma = (s, p) => { const a = wma(s, Math.round(p / 2)), b = wma(s, p);
    return wma(a.map((x, i) => 2 * x - b[i]), Math.round(Math.sqrt(p))); };
  const dema = (s, p) => { const e = ema(s, p), e2 = ema(e, p); return e.map((x, i) => 2 * x - e2[i]); };
  const tema = (s, p) => { const e = ema(s, p), e2 = ema(e, p), e3 = ema(e2, p); return e.map((x, i) => 3 * x - 3 * e2[i] + e3[i]); };
  function zlema(s, p) { const lag = Math.floor((p - 1) / 2); return ema(s.map((x, i) => i >= lag ? 2 * x - s[i - lag] : N), p); }
  function kama(s, p = 10, f = 2, sl = 30) { const r = arr(s.length), fa = 2 / (f + 1), sa = 2 / (sl + 1);
    for (let i = p; i < s.length; i++) { const ch = Math.abs(s[i] - s[i - p]); let vol = 0;
      for (let k = i - p + 1; k <= i; k++) vol += Math.abs(s[k] - s[k - 1]);
      const er = vol ? ch / vol : 0, sc = (er * (fa - sa) + sa) ** 2;
      const prev = isn(r[i - 1]) ? s[i - 1] : r[i - 1]; r[i] = prev + sc * (s[i] - prev); } return r; }
  function vwma(c, v, p) { const pv = sma(c.map((x, i) => x * v[i]), p), vv = sma(v, p); return pv.map((x, i) => vv[i] ? x / vv[i] : N); }
  function stdev(s, p) { const m = sma(s, p), r = arr(s.length);
    for (let i = p - 1; i < s.length; i++) { if (isn(m[i])) continue; let t = 0;
      for (let k = i - p + 1; k <= i; k++) t += (s[k] - m[i]) ** 2; r[i] = Math.sqrt(t / p); } return r; }
  function highest(s, p) { const r = arr(s.length); for (let i = p - 1; i < s.length; i++) { let m = -Infinity; for (let k = i - p + 1; k <= i; k++) if (s[k] > m) m = s[k]; r[i] = m; } return r; }
  function lowest(s, p) { const r = arr(s.length); for (let i = p - 1; i < s.length; i++) { let m = Infinity; for (let k = i - p + 1; k <= i; k++) if (s[k] < m) m = s[k]; r[i] = m; } return r; }
  const shift = (s, n = 1) => s.map((_, i) => (i - n >= 0 && i - n < s.length ? s[i - n] : N));
  const diff = (s, n = 1) => s.map((x, i) => (i >= n ? x - s[i - n] : N));
  const roc = (s, p) => s.map((x, i) => (i >= p && s[i - p] ? (x / s[i - p] - 1) * 100 : N));
  const sum = (s, p) => sma(s, p).map(x => x * p);
  function tr(B) { return B.c.map((_, i) => i === 0 ? B.h[0] - B.l[0] : Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - B.c[i - 1]), Math.abs(B.l[i] - B.c[i - 1]))); }
  const atr = (B, p = 14) => rma(tr(B), p);
  function rsi(s, p = 14) { const up = s.map((x, i) => i ? Math.max(x - s[i - 1], 0) : N), dn = s.map((x, i) => i ? Math.max(s[i - 1] - x, 0) : N);
    const au = rma(up, p), ad = rma(dn, p); return au.map((u, i) => ad[i] === 0 ? 100 : 100 - 100 / (1 + u / ad[i])); }
  function macd(s, f = 12, sl = 26) { const a = ema(s, f), b = ema(s, sl); return a.map((x, i) => x - b[i]); }
  function macdFull(s, f = 12, sl = 26, sg = 9) { const ef = ema(s, f), es = ema(s, sl), m = ef.map((x, i) => x - es[i]), sig = ema(m, sg); return { macd: m, signal: sig, hist: m.map((x, i) => x - sig[i]) }; }
  function stoch(B, k = 14, d = 3, smooth = 3) { const hh = highest(B.h, k), ll = lowest(B.l, k);
    const raw = B.c.map((c, i) => hh[i] - ll[i] ? 100 * (c - ll[i]) / (hh[i] - ll[i]) : 50);
    const K = sma(raw, smooth); return { k: K, d: sma(K, d) }; }
  function stochRsi(s, rp = 14, sp = 14, k = 3, d = 3) { const r = rsi(s, rp), hh = highest(r, sp), ll = lowest(r, sp);
    const raw = r.map((x, i) => hh[i] - ll[i] ? 100 * (x - ll[i]) / (hh[i] - ll[i]) : 50); const K = sma(raw, k); return { k: K, d: sma(K, d) }; }
  function willr(B, p = 14) { const hh = highest(B.h, p), ll = lowest(B.l, p); return B.c.map((c, i) => hh[i] - ll[i] ? -100 * (hh[i] - c) / (hh[i] - ll[i]) : -50); }
  function cci(B, p = 20) { const tp = B.c.map((c, i) => (B.h[i] + B.l[i] + c) / 3), m = sma(tp, p), r = arr(tp.length);
    for (let i = p - 1; i < tp.length; i++) { let md = 0; for (let k = i - p + 1; k <= i; k++) md += Math.abs(tp[k] - m[i]); md /= p; r[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0; } return r; }
  function adx(B, p = 14) { const n = B.c.length, pdm = arr(n), mdm = arr(n);
    for (let i = 1; i < n; i++) { const u = B.h[i] - B.h[i - 1], d = B.l[i - 1] - B.l[i]; pdm[i] = u > d && u > 0 ? u : 0; mdm[i] = d > u && d > 0 ? d : 0; }
    const t = rma(tr(B).map((x, i) => i ? x : N), p), pdi = rma(pdm, p).map((x, i) => 100 * x / t[i]), mdi = rma(mdm, p).map((x, i) => 100 * x / t[i]);
    const dx = pdi.map((x, i) => x + mdi[i] ? 100 * Math.abs(x - mdi[i]) / (x + mdi[i]) : 0); return { adx: rma(dx, p), pdi, mdi }; }
  function bollinger(s, p = 20, m = 2) { const mid = sma(s, p), sd = stdev(s, p); const up = mid.map((x, i) => x + m * sd[i]), lo = mid.map((x, i) => x - m * sd[i]);
    return { mid, up, lo, pb: s.map((x, i) => (x - lo[i]) / (up[i] - lo[i])), bw: mid.map((x, i) => (up[i] - lo[i]) / x) }; }
  function keltner(B, p = 20, m = 2, ap = 10) { const mid = ema(B.c, p), a = atr(B, ap); return { mid, up: mid.map((x, i) => x + m * a[i]), lo: mid.map((x, i) => x - m * a[i]) }; }
  function donchian(B, p = 20) { const up = highest(B.h, p), lo = lowest(B.l, p); return { up, lo, mid: up.map((x, i) => (x + lo[i]) / 2) }; }
  function supertrend(B, p = 10, m = 3) { const a = atr(B, p), n = B.c.length, st = arr(n), dir = arr(n); let fu = N, fl = N, d = 1;
    for (let i = 0; i < n; i++) { if (isn(a[i])) continue; const hl = (B.h[i] + B.l[i]) / 2, bu = hl + m * a[i], bl = hl - m * a[i];
      fu = isn(fu) || bu < fu || B.c[i - 1] > fu ? bu : fu; fl = isn(fl) || bl > fl || B.c[i - 1] < fl ? bl : fl;
      if (d === 1 && B.c[i] < fl) d = -1; else if (d === -1 && B.c[i] > fu) d = 1; dir[i] = d; st[i] = d === 1 ? fl : fu; } return { st, dir }; }
  function psar(B, step = 0.02, max = 0.2) { const n = B.c.length, r = arr(n); if (n < 2) return r; let up = B.c[1] >= B.c[0], sar = up ? B.l[0] : B.h[0], ep = up ? B.h[1] : B.l[1], af = step;
    for (let i = 1; i < n; i++) { sar = sar + af * (ep - sar);
      if (up) { sar = Math.min(sar, B.l[i - 1], i > 1 ? B.l[i - 2] : B.l[i - 1]); if (B.l[i] < sar) { up = false; sar = ep; ep = B.l[i]; af = step; } else if (B.h[i] > ep) { ep = B.h[i]; af = Math.min(af + step, max); } }
      else { sar = Math.max(sar, B.h[i - 1], i > 1 ? B.h[i - 2] : B.h[i - 1]); if (B.h[i] > sar) { up = true; sar = ep; ep = B.h[i]; af = step; } else if (B.l[i] < ep) { ep = B.l[i]; af = Math.min(af + step, max); } }
      r[i] = sar; } return r; }
  function ichimoku(B, t = 9, k = 26, s = 52) { const mid = p => { const lo = lowest(B.l, p); return highest(B.h, p).map((x, i) => (x + lo[i]) / 2); };
    const tenkan = mid(t), kijun = mid(k), spanA = shift(tenkan.map((x, i) => (x + kijun[i]) / 2), k), spanB = shift(mid(s), k); return { tenkan, kijun, spanA, spanB, chikou: shift(B.c, -k) }; }
  function obv(B) { let o = 0; return B.c.map((c, i) => (i ? (o += c > B.c[i - 1] ? B.v[i] : c < B.c[i - 1] ? -B.v[i] : 0) : 0)); }
  function adl(B) { let a = 0; return B.c.map((c, i) => { const r = B.h[i] - B.l[i]; a += r ? ((c - B.l[i]) - (B.h[i] - c)) / r * B.v[i] : 0; return a; }); }
  const chaikinOsc = (B, f = 3, s = 10) => { const a = adl(B); const e1 = ema(a, f), e2 = ema(a, s); return e1.map((x, i) => x - e2[i]); };
  function cmf(B, p = 20) { const mfv = B.c.map((c, i) => { const r = B.h[i] - B.l[i]; return r ? ((c - B.l[i]) - (B.h[i] - c)) / r * B.v[i] : 0; }); const a = sum(mfv, p), b = sum(B.v, p); return a.map((x, i) => b[i] ? x / b[i] : 0); }
  function mfi(B, p = 14) { const tp = B.c.map((c, i) => (B.h[i] + B.l[i] + c) / 3), pos = tp.map((x, i) => i && x > tp[i - 1] ? x * B.v[i] : 0), neg = tp.map((x, i) => i && x < tp[i - 1] ? x * B.v[i] : 0);
    const sp = sum(pos, p), sn = sum(neg, p); return sp.map((x, i) => sn[i] === 0 ? 100 : 100 - 100 / (1 + x / sn[i])); }
  function vwapRolling(B, p = 20) { const tp = B.c.map((c, i) => (B.h[i] + B.l[i] + c) / 3); return vwma(tp, B.v, p); }
  const trix = (s, p = 15) => { const e = ema(ema(ema(s, p), p), p); return roc(e, 1); };
  function aroon(B, p = 25) { const n = B.c.length, up = arr(n), dn = arr(n);
    for (let i = p; i < n; i++) { let hi = i, lo = i; for (let k = i - p; k <= i; k++) { if (B.h[k] >= B.h[hi]) hi = k; if (B.l[k] <= B.l[lo]) lo = k; } up[i] = 100 * (p - (i - hi)) / p; dn[i] = 100 * (p - (i - lo)) / p; } return { up, dn, osc: up.map((x, i) => x - dn[i]) }; }
  const medianPrice = B => B.h.map((h, i) => (h + B.l[i]) / 2);
  const ao = B => { const m = medianPrice(B), a = sma(m, 5), b = sma(m, 34); return a.map((x, i) => x - b[i]); };
  function uo(B, a = 7, b = 14, c = 28) { const bp = B.c.map((x, i) => i ? x - Math.min(B.l[i], B.c[i - 1]) : 0), t = tr(B);
    const av = p => { const st = sum(t, p); return sum(bp, p).map((x, i) => x / st[i]); }; const A = av(a), Bb = av(b), C = av(c); return A.map((x, i) => 100 * (4 * x + 2 * Bb[i] + C[i]) / 7); }
  function vortex(B, p = 14) { const vp = B.h.map((h, i) => i ? Math.abs(h - B.l[i - 1]) : N), vm = B.l.map((l, i) => i ? Math.abs(l - B.h[i - 1]) : N), t = sum(tr(B), p);
    return { plus: sum(vp, p).map((x, i) => x / t[i]), minus: sum(vm, p).map((x, i) => x / t[i]) }; }
  const forceIndex = (B, p = 13) => ema(B.c.map((c, i) => (i ? (c - B.c[i - 1]) * B.v[i] : N)), p);
  const elderRay = (B, p = 13) => { const e = ema(B.c, p); return { bull: B.h.map((h, i) => h - e[i]), bear: B.l.map((l, i) => l - e[i]) }; };
  function kst(s) { const r = (a, b) => sma(roc(s, a), b); const x = [r(10, 10), r(15, 10), r(20, 10), r(30, 15)]; const k = x[0].map((v, i) => v + 2 * x[1][i] + 3 * x[2][i] + 4 * x[3][i]); return { kst: k, signal: sma(k, 9) }; }
  const coppock = (s, a = 14, b = 11, w = 10) => { const rb = roc(s, b); return wma(roc(s, a).map((x, i) => x + rb[i]), w); };
  const dpo = (s, p = 20) => { const m = sma(s, p), k = Math.floor(p / 2) + 1; return s.map((x, i) => x - (i >= k ? m[i - k] : N)); };
  const ppo = (s, f = 12, sl = 26) => { const a = ema(s, f), b = ema(s, sl); return a.map((x, i) => 100 * (x - b[i]) / b[i]); };
  function cmo(s, p = 14) { const u = s.map((x, i) => (i ? Math.max(x - s[i - 1], 0) : N)), d = s.map((x, i) => (i ? Math.max(s[i - 1] - x, 0) : N)); const su = sum(u, p), sd = sum(d, p); return su.map((x, i) => (x + sd[i] ? 100 * (x - sd[i]) / (x + sd[i]) : 0)); }
  function fisher(B, p = 10) { const m = medianPrice(B), hh = highest(m, p), ll = lowest(m, p), n = m.length, r = arr(n); let v = 0, f = 0;
    for (let i = p - 1; i < n; i++) { const rng = hh[i] - ll[i] || 1e-9; v = 0.66 * ((m[i] - ll[i]) / rng - 0.5) + 0.67 * v; v = Math.max(Math.min(v, 0.999), -0.999); f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * f; r[i] = f; } return r; }
  function schaff(s, f = 23, sl = 50, cyc = 10) { const m = ppo(s, f, sl).map((x, i) => x); const st = (x) => { const hh = highest(x, cyc), ll = lowest(x, cyc); const raw = x.map((v, i) => (hh[i] - ll[i] ? 100 * (v - ll[i]) / (hh[i] - ll[i]) : 50)); return ema(raw, 3); }; return st(st(m)); }
  function chop(B, p = 14) { const t = sum(tr(B), p), hh = highest(B.h, p), ll = lowest(B.l, p); return t.map((x, i) => 100 * Math.log10(x / (hh[i] - ll[i])) / Math.log10(p)); }
  function eom(B, p = 14) { const m = medianPrice(B); return sma(m.map((x, i) => i && B.v[i] ? (x - m[i - 1]) / (B.v[i] / 1e8 / (B.h[i] - B.l[i] || 1e-9)) : N), p); }
  function massIndex(B, p = 25) { const r = B.h.map((h, i) => h - B.l[i]), e1 = ema(r, 9), e2 = ema(e1, 9); return sum(e1.map((x, i) => x / e2[i]), p); }
  function ulcer(s, p = 14) { const hh = highest(s, p), dd = s.map((x, i) => (100 * (x - hh[i]) / hh[i]) ** 2); return sma(dd, p).map(Math.sqrt); }
  const histVol = (s, p = 20) => stdev(s.map((x, i) => (i ? Math.log(x / s[i - 1]) : N)), p).map(x => x * Math.sqrt(252) * 100);
  const zscore = (s, p = 20) => { const m = sma(s, p), sd = stdev(s, p); return s.map((x, i) => (sd[i] ? (x - m[i]) / sd[i] : 0)); };
  function tsi(s, l = 25, sh = 13) { const m = diff(s), a = ema(ema(m, l), sh), b = ema(ema(m.map(Math.abs), l), sh); return a.map((x, i) => (b[i] ? 100 * x / b[i] : 0)); }
  function rvi(B, p = 10) { const num = sma(B.c.map((c, i) => c - B.o[i]), p), den = sma(B.h.map((h, i) => h - B.l[i]), p); const r = num.map((x, i) => (den[i] ? x / den[i] : 0)); return { rvi: r, signal: sma(r, 4) }; }
  function klinger(B, f = 34, s = 55, sg = 13) { const hlc = B.c.map((c, i) => B.h[i] + B.l[i] + c); const vf = B.v.map((v, i) => (i ? (hlc[i] > hlc[i - 1] ? v : -v) : 0)); const es = ema(vf, s); const k = ema(vf, f).map((x, i) => x - es[i]); return { kvo: k, signal: ema(k, sg) }; }
  const momentum = (s, p = 10) => diff(s, p);
  const envelopes = (s, p = 20, pct = 2.5) => { const m = sma(s, p); return { mid: m, up: m.map(x => x * (1 + pct / 100)), lo: m.map(x => x * (1 - pct / 100)) }; };
  function alligator(B) { const m = medianPrice(B); return { jaw: shift(rma(m, 13), 8), teeth: shift(rma(m, 8), 5), lips: shift(rma(m, 5), 3) }; }
  function heikin(B) { const n = B.c.length, o = arr(n), c = arr(n), h = arr(n), l = arr(n);
    for (let i = 0; i < n; i++) { c[i] = (B.o[i] + B.h[i] + B.l[i] + B.c[i]) / 4; o[i] = i ? (o[i - 1] + c[i - 1]) / 2 : (B.o[0] + B.c[0]) / 2; h[i] = Math.max(B.h[i], o[i], c[i]); l[i] = Math.min(B.l[i], o[i], c[i]); } return { o, h, l, c }; }
  function connorsRsi(s, a = 3, b = 2, c = 100) { const streak = []; let st = 0; s.forEach((x, i) => { if (!i) st = 0; else if (x > s[i - 1]) st = st > 0 ? st + 1 : 1; else if (x < s[i - 1]) st = st < 0 ? st - 1 : -1; else st = 0; streak.push(st); });
    const r1 = rsi(s, a), r2 = rsi(streak, b), r = roc(s, 1), pr = r.map((x, i) => { if (i < c) return N; let k = 0; for (let j = i - c; j < i; j++) if (r[j] < x) k++; return 100 * k / c; }); return r1.map((x, i) => (x + r2[i] + pr[i]) / 3); }
  function fractals(B) { const n = B.c.length, up = new Array(n).fill(false), dn = new Array(n).fill(false);
    for (let i = 2; i < n - 2; i++) { if (B.h[i] > B.h[i - 1] && B.h[i] > B.h[i - 2] && B.h[i] > B.h[i + 1] && B.h[i] > B.h[i + 2]) up[i + 2] = true; if (B.l[i] < B.l[i - 1] && B.l[i] < B.l[i - 2] && B.l[i] < B.l[i + 1] && B.l[i] < B.l[i + 2]) dn[i + 2] = true; } return { up, dn }; } // marked when confirmed (2 bars later)
  function pivots(B) { const P = B.c.map((c, i) => i ? (B.h[i - 1] + B.l[i - 1] + B.c[i - 1]) / 3 : N); return { p: P, r1: P.map((p, i) => 2 * p - B.l[i - 1]), s1: P.map((p, i) => 2 * p - B.h[i - 1]), r2: P.map((p, i) => p + (B.h[i - 1] - B.l[i - 1])), s2: P.map((p, i) => p - (B.h[i - 1] - B.l[i - 1])) }; }
  function linreg(s, p = 20) { const r = arr(s.length), slope = arr(s.length); const xm = (p - 1) / 2; let den = 0; for (let k = 0; k < p; k++) den += (k - xm) ** 2;
    for (let i = p - 1; i < s.length; i++) { let ym = 0; for (let k = 0; k < p; k++) ym += s[i - p + 1 + k]; ym /= p; let num = 0; for (let k = 0; k < p; k++) num += (k - xm) * (s[i - p + 1 + k] - ym); const b = num / den; slope[i] = b; r[i] = ym + b * (p - 1 - xm); } return { value: r, slope }; }
  function chandelier(B, p = 22, m = 3) { const a = atr(B, p), hh = highest(B.h, p), ll = lowest(B.l, p); return { long: hh.map((x, i) => x - m * a[i]), short: ll.map((x, i) => x + m * a[i]) }; }
  const efficiency = (s, p = 10) => s.map((x, i) => { if (i < p) return N; let v = 0; for (let k = i - p + 1; k <= i; k++) v += Math.abs(s[k] - s[k - 1]); return v ? Math.abs(x - s[i - p]) / v : 0; });

  G.TA = { nz, isn, sma, ema, rma, wma, hma, dema, tema, zlema, kama, vwma, stdev, highest, lowest, shift, diff, roc, sum, tr, atr, rsi, macd, macdFull, stoch, stochRsi, willr, cci, adx, bollinger, keltner, donchian, supertrend, psar, ichimoku, obv, adl, chaikinOsc, cmf, mfi, vwapRolling, trix, aroon, ao, uo, vortex, forceIndex, elderRay, kst, coppock, dpo, ppo, cmo, fisher, schaff, chop, eom, massIndex, ulcer, histVol, zscore, tsi, rvi, klinger, momentum, envelopes, alligator, heikin, connorsRsi, fractals, pivots, linreg, chandelier, efficiency, medianPrice };

  // Indicator catalog for the chart UI. overlay=true draws on price; else separate pane.
  const P = (name, def) => ({ name, def });
  G.INDICATORS = [
    { id: 'sma', name: 'Simple Moving Average (SMA)', overlay: true, params: [P('period', 50)], calc: (B, p) => ({ SMA: sma(B.c, p.period) }) },
    { id: 'ema', name: 'Exponential Moving Average (EMA)', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ EMA: ema(B.c, p.period) }) },
    { id: 'wma', name: 'Weighted Moving Average (WMA)', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ WMA: wma(B.c, p.period) }) },
    { id: 'hma', name: 'Hull Moving Average (HMA)', overlay: true, params: [P('period', 21)], calc: (B, p) => ({ HMA: hma(B.c, p.period) }) },
    { id: 'dema', name: 'Double EMA (DEMA)', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ DEMA: dema(B.c, p.period) }) },
    { id: 'tema', name: 'Triple EMA (TEMA)', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ TEMA: tema(B.c, p.period) }) },
    { id: 'zlema', name: 'Zero-Lag EMA', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ ZLEMA: zlema(B.c, p.period) }) },
    { id: 'kama', name: 'Kaufman Adaptive MA (KAMA)', overlay: true, params: [P('period', 10)], calc: (B, p) => ({ KAMA: kama(B.c, p.period) }) },
    { id: 'vwma', name: 'Volume Weighted MA (VWMA)', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ VWMA: vwma(B.c, B.v, p.period) }) },
    { id: 'vwap', name: 'Rolling VWAP', overlay: true, params: [P('period', 20)], calc: (B, p) => ({ VWAP: vwapRolling(B, p.period) }) },
    { id: 'bb', name: 'Bollinger Bands', overlay: true, params: [P('period', 20), P('mult', 2)], calc: (B, p) => { const b = bollinger(B.c, p.period, p.mult); return { Upper: b.up, Mid: b.mid, Lower: b.lo }; } },
    { id: 'kc', name: 'Keltner Channels', overlay: true, params: [P('period', 20), P('mult', 2)], calc: (B, p) => { const k = keltner(B, p.period, p.mult); return { Upper: k.up, Mid: k.mid, Lower: k.lo }; } },
    { id: 'dc', name: 'Donchian Channels', overlay: true, params: [P('period', 20)], calc: (B, p) => { const k = donchian(B, p.period); return { Upper: k.up, Mid: k.mid, Lower: k.lo }; } },
    { id: 'env', name: 'Moving Average Envelopes', overlay: true, params: [P('period', 20), P('pct', 2.5)], calc: (B, p) => { const k = envelopes(B.c, p.period, p.pct); return { Upper: k.up, Mid: k.mid, Lower: k.lo }; } },
    { id: 'st', name: 'Supertrend', overlay: true, params: [P('period', 10), P('mult', 3)], calc: (B, p) => ({ Supertrend: supertrend(B, p.period, p.mult).st }) },
    { id: 'psar', name: 'Parabolic SAR', overlay: true, dots: true, params: [P('step', 0.02), P('max', 0.2)], calc: (B, p) => ({ PSAR: psar(B, p.step, p.max) }) },
    { id: 'ichi', name: 'Ichimoku Cloud', overlay: true, params: [P('tenkan', 9), P('kijun', 26), P('senkou', 52)], calc: (B, p) => { const k = ichimoku(B, p.tenkan, p.kijun, p.senkou); return { Tenkan: k.tenkan, Kijun: k.kijun, SpanA: k.spanA, SpanB: k.spanB }; } },
    { id: 'alli', name: 'Williams Alligator', overlay: true, params: [], calc: B => { const a = alligator(B); return { Jaw: a.jaw, Teeth: a.teeth, Lips: a.lips }; } },
    { id: 'chand', name: 'Chandelier Exit', overlay: true, params: [P('period', 22), P('mult', 3)], calc: (B, p) => ({ Long: chandelier(B, p.period, p.mult).long }) },
    { id: 'linreg', name: 'Linear Regression Line', overlay: true, params: [P('period', 50)], calc: (B, p) => ({ LinReg: linreg(B.c, p.period).value }) },
    { id: 'piv', name: 'Pivot Points (Classic)', overlay: true, params: [], calc: B => { const k = pivots(B); return { P: k.p, R1: k.r1, S1: k.s1 }; } },
    { id: 'rsi', name: 'Relative Strength Index (RSI)', params: [P('period', 14)], levels: [30, 70], calc: (B, p) => ({ RSI: rsi(B.c, p.period) }) },
    { id: 'macd', name: 'MACD', params: [P('fast', 12), P('slow', 26), P('signal', 9)], hist: 'Hist', calc: (B, p) => { const m = macdFull(B.c, p.fast, p.slow, p.signal); return { MACD: m.macd, Signal: m.signal, Hist: m.hist }; } },
    { id: 'stoch', name: 'Stochastic Oscillator', params: [P('k', 14), P('d', 3)], levels: [20, 80], calc: (B, p) => { const s = stoch(B, p.k, p.d); return { K: s.k, D: s.d }; } },
    { id: 'stochrsi', name: 'Stochastic RSI', params: [P('period', 14)], levels: [20, 80], calc: (B, p) => { const s = stochRsi(B.c, p.period, p.period); return { K: s.k, D: s.d }; } },
    { id: 'cci', name: 'Commodity Channel Index (CCI)', params: [P('period', 20)], levels: [-100, 100], calc: (B, p) => ({ CCI: cci(B, p.period) }) },
    { id: 'willr', name: 'Williams %R', params: [P('period', 14)], levels: [-80, -20], calc: (B, p) => ({ '%R': willr(B, p.period) }) },
    { id: 'adx', name: 'ADX / DMI', params: [P('period', 14)], levels: [25], calc: (B, p) => { const a = adx(B, p.period); return { ADX: a.adx, '+DI': a.pdi, '-DI': a.mdi }; } },
    { id: 'atr', name: 'Average True Range (ATR)', params: [P('period', 14)], calc: (B, p) => ({ ATR: atr(B, p.period) }) },
    { id: 'obv', name: 'On-Balance Volume (OBV)', params: [], calc: B => ({ OBV: obv(B) }) },
    { id: 'adl', name: 'Accumulation/Distribution Line', params: [], calc: B => ({ ADL: adl(B) }) },
    { id: 'cho', name: 'Chaikin Oscillator', params: [], calc: B => ({ ChaikinOsc: chaikinOsc(B) }) },
    { id: 'cmf', name: 'Chaikin Money Flow (CMF)', params: [P('period', 20)], levels: [0], calc: (B, p) => ({ CMF: cmf(B, p.period) }) },
    { id: 'mfi', name: 'Money Flow Index (MFI)', params: [P('period', 14)], levels: [20, 80], calc: (B, p) => ({ MFI: mfi(B, p.period) }) },
    { id: 'roc', name: 'Rate of Change (ROC)', params: [P('period', 12)], levels: [0], calc: (B, p) => ({ ROC: roc(B.c, p.period) }) },
    { id: 'mom', name: 'Momentum', params: [P('period', 10)], levels: [0], calc: (B, p) => ({ MOM: momentum(B.c, p.period) }) },
    { id: 'trix', name: 'TRIX', params: [P('period', 15)], levels: [0], calc: (B, p) => ({ TRIX: trix(B.c, p.period) }) },
    { id: 'aroon', name: 'Aroon', params: [P('period', 25)], calc: (B, p) => { const a = aroon(B, p.period); return { Up: a.up, Down: a.dn }; } },
    { id: 'ao', name: 'Awesome Oscillator', params: [], hist: 'AO', calc: B => ({ AO: ao(B) }) },
    { id: 'uo', name: 'Ultimate Oscillator', params: [], levels: [30, 70], calc: B => ({ UO: uo(B) }) },
    { id: 'vortex', name: 'Vortex Indicator', params: [P('period', 14)], calc: (B, p) => { const v = vortex(B, p.period); return { 'VI+': v.plus, 'VI-': v.minus }; } },
    { id: 'fi', name: 'Elder Force Index', params: [P('period', 13)], levels: [0], calc: (B, p) => ({ FI: forceIndex(B, p.period) }) },
    { id: 'er', name: 'Elder Ray (Bull/Bear Power)', params: [P('period', 13)], calc: (B, p) => { const e = elderRay(B, p.period); return { Bull: e.bull, Bear: e.bear }; } },
    { id: 'kst', name: 'Know Sure Thing (KST)', params: [], calc: B => { const k = kst(B.c); return { KST: k.kst, Signal: k.signal }; } },
    { id: 'cop', name: 'Coppock Curve', params: [], levels: [0], calc: B => ({ Coppock: coppock(B.c) }) },
    { id: 'dpo', name: 'Detrended Price Oscillator', params: [P('period', 20)], levels: [0], calc: (B, p) => ({ DPO: dpo(B.c, p.period) }) },
    { id: 'ppo', name: 'Percentage Price Oscillator', params: [], levels: [0], calc: B => ({ PPO: ppo(B.c) }) },
    { id: 'cmo', name: 'Chande Momentum Oscillator', params: [P('period', 14)], levels: [-50, 50], calc: (B, p) => ({ CMO: cmo(B.c, p.period) }) },
    { id: 'fisher', name: 'Ehlers Fisher Transform', params: [P('period', 10)], levels: [0], calc: (B, p) => ({ Fisher: fisher(B, p.period) }) },
    { id: 'stc', name: 'Schaff Trend Cycle', params: [], levels: [25, 75], calc: B => ({ STC: schaff(B.c) }) },
    { id: 'chop', name: 'Choppiness Index', params: [P('period', 14)], levels: [38.2, 61.8], calc: (B, p) => ({ CHOP: chop(B, p.period) }) },
    { id: 'eom', name: 'Ease of Movement', params: [P('period', 14)], levels: [0], calc: (B, p) => ({ EOM: eom(B, p.period) }) },
    { id: 'mass', name: 'Mass Index', params: [], levels: [27], calc: B => ({ Mass: massIndex(B) }) },
    { id: 'ulcer', name: 'Ulcer Index', params: [P('period', 14)], calc: (B, p) => ({ Ulcer: ulcer(B.c, p.period) }) },
    { id: 'hv', name: 'Historical Volatility (annualised %)', params: [P('period', 20)], calc: (B, p) => ({ HV: histVol(B.c, p.period) }) },
    { id: 'z', name: 'Z-Score', params: [P('period', 20)], levels: [-2, 2], calc: (B, p) => ({ Z: zscore(B.c, p.period) }) },
    { id: 'tsi', name: 'True Strength Index', params: [], levels: [0], calc: B => ({ TSI: tsi(B.c) }) },
    { id: 'rvi', name: 'Relative Vigor Index', params: [], calc: B => { const r = rvi(B); return { RVI: r.rvi, Signal: r.signal }; } },
    { id: 'kvo', name: 'Klinger Volume Oscillator', params: [], calc: B => { const k = klinger(B); return { KVO: k.kvo, Signal: k.signal }; } },
    { id: 'crsi', name: 'Connors RSI', params: [], levels: [10, 90], calc: B => ({ CRSI: connorsRsi(B.c) }) },
    { id: 'bbw', name: 'Bollinger Bandwidth', params: [P('period', 20)], calc: (B, p) => ({ BBW: bollinger(B.c, p.period).bw }) },
    { id: 'pctb', name: 'Bollinger %B', params: [P('period', 20)], levels: [0, 1], calc: (B, p) => ({ '%B': bollinger(B.c, p.period).pb }) },
    { id: 'er10', name: 'Kaufman Efficiency Ratio', params: [P('period', 10)], calc: (B, p) => ({ ER: efficiency(B.c, p.period) }) },
    { id: 'lrs', name: 'Linear Regression Slope', params: [P('period', 20)], levels: [0], calc: (B, p) => ({ Slope: linreg(B.c, p.period).slope }) },
  ];
})(window);
