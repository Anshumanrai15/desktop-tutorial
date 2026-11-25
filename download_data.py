#!/usr/bin/env python3
"""
Nifty 100 data downloader for the Paper Trader app.

Downloads the LONGEST available daily OHLCV history for every Nifty 100 stock
(+ Nifty 50 / Nifty 100 / Bank Nifty indices) and writes:
    data/csv/<SYMBOL>.csv      - plain CSV (Date,Open,High,Low,Close,Volume)
    data/<SYMBOL>.js           - compact file the browser app loads (works from file://)
    data/manifest.js           - list of available symbols

Sources, tried in order for each symbol:
    1. Yahoo Finance via yfinance  (period="max", split/dividend adjusted; usually 1996/2002 -> today)
    2. NSE website via jugaad-data (unadjusted, back to ~2000; slower, breaks when NSE changes site)

Usage:
    pip install yfinance pandas jugaad-data
    python download_data.py                 # all Nifty 100 + indices
    python download_data.py RELIANCE TCS    # only some symbols
    python download_data.py --update        # re-download everything (run daily to refresh)
    python download_data.py --update --restore-from=https://you.github.io/site/
                                            # first copy the live site's data, so days a lagging
                                            # source leaves out are never lost (used by the workflow)

The constituent list is pulled live from NSE archives when reachable; otherwise the
built-in list below is used. Edit symbols.txt (one NSE symbol per line) to use your own list.
"""
import io
import json
import os
import sys
import time
import zipfile
from datetime import date, datetime, timedelta

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
CSV_DIR = os.path.join(DATA, "csv")

# Built-in Nifty 100 list (NSE, Nov 2026). Used only if NSE's live list can't be fetched.
NIFTY100 = """
ABB ADANIENSOL ADANIENT ADANIGREEN ADANIPORTS ADANIPOWER AMBUJACEM APOLLOHOSP ASIANPAINT DMART
AXISBANK BSE BAJAJ-AUTO BAJFINANCE BAJAJFINSV BAJAJHLDNG BANKBARODA BEL BPCL BHARTIARTL
BOSCHLTD BRITANNIA CGPOWER CANBK CHOLAFIN CIPLA COALINDIA CUMMINSIND DLF DIVISLAB
DRREDDY EICHERMOT ETERNAL GAIL GODREJCP GRASIM HCLTECH HDFCAMC HDFCBANK HDFCLIFE
HINDALCO HAL HINDUNILVR HINDZINC POWERINDIA HYUNDAI ICICIBANK ITC IOC IRFC
INFY INDIGO JSWSTEEL JINDALSTEL JIOFIN KOTAKBANK LTM LT M&M MARUTI
MAXHEALTH MAZDOCK MUTHOOTFIN NTPC NESTLEIND ONGC PIDILITIND POLYCAB PFC POWERGRID
PNB RELIANCE SBILIFE MOTHERSON SHRIRAMFIN ENRIN SIEMENS SOLARINDS SBIN SUNPHARMA
TVSMOTOR TATACAP TCS TATACONSUM TMCV TMPV TATAPOWER TATASTEEL TECHM TITAN
TORNTPHARM TRENT ULTRACEMCO UNIONBANK VBL VAML VEDL IDEA WIPRO ZYDUSLIFE
""".split()

# Indices (Yahoo codes)
INDICES = {"NIFTY50": "^NSEI", "NIFTY100": "^CNX100", "BANKNIFTY": "^NSEBANK", "INDIAVIX": "^INDIAVIX"}

# Yahoo uses different codes for a few renamed / demerged symbols. Tried in order.
ALIASES = {
    "M&M": ["M&M.NS"],
    "ETERNAL": ["ETERNAL.NS", "ZOMATO.NS"],
    "TMPV": ["TMPV.NS", "TATAMOTORS.NS"],
    "LTIM": ["LTIM.NS", "LTI.NS"],
    "BAJAJ-AUTO": ["BAJAJ-AUTO.NS"],
}


def get_symbol_list():
    custom = os.path.join(ROOT, "symbols.txt")
    if os.path.exists(custom):
        syms = [s.strip().upper() for s in open(custom) if s.strip() and not s.startswith("#")]
        print(f"Using {len(syms)} symbols from symbols.txt")
        return syms
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://archives.nseindia.com/content/indices/ind_nifty100list.csv",
            headers={"User-Agent": "Mozilla/5.0"})
        raw = urllib.request.urlopen(req, timeout=15).read().decode()
        df = pd.read_csv(io.StringIO(raw))
        syms = [s.strip() for s in df["Symbol"].tolist()]
        if "Company Name" in df.columns:
            names = {r["Symbol"].strip(): str(r["Company Name"]).strip() for _, r in df.iterrows()}
            os.makedirs(DATA, exist_ok=True)
            with open(os.path.join(DATA, "names.json"), "w") as f:
                json.dump(names, f)
        if len(syms) >= 90:
            print(f"Fetched live Nifty 100 list from NSE ({len(syms)} symbols)")
            return syms
    except Exception as e:
        print("Could not fetch live Nifty 100 list from NSE, using built-in list:", e)
    return NIFTY100


def from_yahoo(sym, yahoo_codes):
    import yfinance as yf
    for code in yahoo_codes:
        try:
            t = yf.Ticker(code)
            df = t.history(period="max", interval="1d", auto_adjust=True, actions=False)
            if df is not None and len(df) > 20:
                # Yahoo's full-history answer sometimes lags by a day or two; the last-month
                # request usually has the newest days, so combine both (newer rows win).
                try:
                    recent = t.history(period="1mo", interval="1d", auto_adjust=True, actions=False)
                    if recent is not None and len(recent):
                        df = pd.concat([df, recent])
                except Exception as e:
                    print(f"   yahoo {code} recent-days request failed: {e}")
                df = df.reset_index()
                df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None).dt.strftime("%Y-%m-%d")
                df = df.drop_duplicates("Date", keep="last")
                return df[["Date", "Open", "High", "Low", "Close", "Volume"]], f"yahoo:{code}"
        except Exception as e:
            print(f"   yahoo {code} failed: {e}")
    return None, None


def from_nse(sym):
    try:
        from jugaad_data.nse import stock_df
    except ImportError:
        return None, None
    try:
        df = stock_df(symbol=sym, from_date=date(2000, 1, 1), to_date=date.today(), series="EQ")
        if df is None or df.empty:
            return None, None
        df = df.rename(columns={"DATE": "Date", "OPEN": "Open", "HIGH": "High", "LOW": "Low",
                                "CLOSE": "Close", "VOLUME": "Volume"})
        df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
        return df[["Date", "Open", "High", "Low", "Close", "Volume"]], "nse:jugaad"
    except Exception as e:
        print(f"   nse {sym} failed: {e}")
        return None, None


def clean(df):
    df = df.dropna(subset=["Open", "High", "Low", "Close"]).copy()
    df = df[(df["Close"] > 0) & (df["Open"] > 0)]
    df["High"] = df[["High", "Open", "Close"]].max(axis=1)
    df["Low"] = df[["Low", "Open", "Close"]].min(axis=1)
    df["Volume"] = df["Volume"].fillna(0).astype("int64")
    df = df.drop_duplicates("Date").sort_values("Date")
    return df


def read_js(path):
    """Read a data/<SYMBOL>.js file back into a DataFrame (None if missing or unreadable)."""
    try:
        t = open(path).read()
        d = json.loads(t[t.index("(") + 1:t.rindex(")")])
        return pd.DataFrame({"Date": d["d"], "Open": d["o"], "High": d["h"], "Low": d["l"],
                             "Close": d["c"], "Volume": d["v"]})
    except Exception:
        return None


def keep_newer_days(fn, df):
    """Never let an update make data older: if the previously saved file has days that the
    new download is missing at the end (a lagging source), carry those days over."""
    old = read_js(os.path.join(DATA, fn + ".js"))
    if old is None or old.empty:
        return df, 0
    extra = old[old["Date"] > df["Date"].iloc[-1]]
    if extra.empty:
        return df, 0
    return pd.concat([df, extra], ignore_index=True), len(extra)


def restore_from(site):
    """Download the currently published data files from the live site into data/, so a
    lagging source can't roll the site's prices backwards (used by the GitHub workflow)."""
    import urllib.request
    site = site.rstrip("/") + "/"
    try:
        man = urllib.request.urlopen(site + "data/manifest.js", timeout=30).read().decode()
        items = json.loads(man[man.index("["):man.rindex("]") + 1])
    except Exception as e:
        print("Could not read the published manifest, starting fresh:", e)
        return
    n = 0
    for it in items:
        try:
            raw = urllib.request.urlopen(site + "data/" + it["file"], timeout=30).read()
            with open(os.path.join(DATA, it["file"]), "wb") as f:
                f.write(raw)
            n += 1
        except Exception as e:
            print("  could not restore", it.get("file"), e)
    print(f"Restored {n} published data files from {site}")


# ── NSE end-of-day "bhavcopy": the official daily closing prices, used to fill recent days ──
NSE_INDEX_NAMES = {"NIFTY50": "Nifty 50", "NIFTY100": "Nifty 100", "BANKNIFTY": "Nifty Bank", "INDIAVIX": "India VIX"}


def nse_get(url):
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "*/*",
                                               "Referer": "https://www.nseindia.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def num(x):
    try:
        v = float(str(x).replace(",", "").strip())
        return v if v == v else 0.0
    except ValueError:
        return 0.0


def nse_day(day):
    """{symbol: (open, high, low, close, volume)} for one trading day from NSE's published files,
    or None if NSE has no file for that day (holiday, weekend, not published yet)."""
    out = {}
    try:
        raw = nse_get(f"https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{day:%Y%m%d}_F_0000.csv.zip")
        z = zipfile.ZipFile(io.BytesIO(raw))
        df = pd.read_csv(z.open(z.namelist()[0]))
        df = df[df["SctySrs"].astype(str).str.strip() == "EQ"]
        for r in df.itertuples(index=False):
            out[str(r.TckrSymb).strip()] = (num(r.OpnPric), num(r.HghPric), num(r.LwPric), num(r.ClsPric), int(num(r.TtlTradgVol)))
    except Exception:
        return None
    try:
        ind = pd.read_csv(io.BytesIO(nse_get(f"https://nsearchives.nseindia.com/content/indices/ind_close_all_{day:%d%m%Y}.csv")))
        names = {str(n).strip().lower(): i for i, n in enumerate(ind["Index Name"])}
        for sym, name in NSE_INDEX_NAMES.items():
            i = names.get(name.lower())
            if i is not None:
                r = ind.iloc[i]
                out[sym] = (num(r["Open Index Value"]), num(r["High Index Value"]), num(r["Low Index Value"]),
                            num(r["Closing Index Value"]), int(num(r.get("Volume", 0))))
    except Exception as e:
        print(f"   NSE index file for {day} not available: {e}")
    return out


def fill_from_nse(written):
    """Yahoo is often late with Indian end-of-day prices. For every trading day after a symbol's
    last bar (up to today, India time), add that day's official close from NSE's bhavcopy."""
    if not written:
        return
    today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()
    oldest = min(df["Date"].iloc[-1] for df, _, _ in written.values())
    start = max(datetime.strptime(oldest, "%Y-%m-%d").date() + timedelta(days=1), today - timedelta(days=10))
    days = [start + timedelta(days=k) for k in range((today - start).days + 1)]
    days = [d for d in days if d.weekday() < 5]
    changed = set()
    for d in days:
        rows = nse_day(d)
        if not rows:
            print(f"NSE bhavcopy {d}: not available (holiday or not published yet)")
            continue
        ds, n = d.isoformat(), 0
        for sym, item in written.items():
            df = item[0]
            if sym in rows and df["Date"].iloc[-1] < ds:
                o, h, l, c, v = rows[sym]
                if c > 0:
                    item[0] = pd.concat([df, pd.DataFrame([{"Date": ds, "Open": o or c, "High": max(h, o, c), "Low": min(x for x in (l, o, c) if x > 0),
                                                            "Close": c, "Volume": v}])], ignore_index=True)
                    changed.add(sym); n += 1
        print(f"NSE bhavcopy {d}: added this day for {n} symbols")
    for sym in changed:
        df, src, kind = written[sym]
        write_js(sym, df, src if "bhavcopy" in src else src + " + NSE bhavcopy", kind)
    if changed:
        print(f"Filled recent days from NSE for {len(changed)} symbols")


def read_meta(path):
    try:
        head = open(path).read(400)
        return head.split('"source":"')[1].split('"')[0], head.split('"kind":"')[1].split('"')[0]
    except Exception:
        return "unknown", "stock"


def write_js(sym, df, source, kind):
    r = lambda s: [round(float(x), 2) for x in s]
    payload = {
        "symbol": sym, "kind": kind, "source": source,
        "d": df["Date"].tolist(), "o": r(df["Open"]), "h": r(df["High"]),
        "l": r(df["Low"]), "c": r(df["Close"]), "v": df["Volume"].astype(int).tolist(),
    }
    fn = sym.replace("&", "_").replace("-", "_")
    with open(os.path.join(DATA, fn + ".js"), "w") as f:
        f.write("NPT_DATA.register(" + json.dumps(payload, separators=(",", ":")) + ");\n")
    df.to_csv(os.path.join(CSV_DIR, fn + ".csv"), index=False)
    return fn


def write_manifest():
    items = []
    names = {}
    try:
        names = json.load(open(os.path.join(DATA, "names.json")))
    except Exception:
        pass
    for f in sorted(os.listdir(DATA)):
        if f.endswith(".js") and f not in ("manifest.js", "summary.js"):
            with open(os.path.join(DATA, f)) as fh:
                head = fh.read(400)
            try:
                sym = head.split('"symbol":"')[1].split('"')[0]
                kind = head.split('"kind":"')[1].split('"')[0]
            except IndexError:
                continue
            item = {"symbol": sym, "file": f, "kind": kind}
            if sym in names:
                item["name"] = names[sym]
            items.append(item)
    with open(os.path.join(DATA, "manifest.js"), "w") as f:
        f.write("window.NPT_MANIFEST = " + json.dumps(items, indent=0) + ";\n")
    print(f"\nmanifest.js written with {len(items)} instruments")
    write_summary(items)


def write_summary(items):
    """data/summary.js: a few numbers per symbol (latest close, previous close, 52-week high/low,
    close a year ago) so the app can show prices in search and the watchlist without downloading
    every symbol's full history."""
    out = {}
    for it in items:
        df = read_js(os.path.join(DATA, it["file"]))
        if df is None or df.empty:
            continue
        n = len(df)
        y = max(0, n - 252)
        out[it["symbol"]] = {
            "d": df["Date"].iloc[-1], "c": round(float(df["Close"].iloc[-1]), 2),
            "p": round(float(df["Close"].iloc[-2]), 2) if n > 1 else None,
            "h": round(float(df["High"].iloc[y:].max()), 2), "l": round(float(df["Low"].iloc[y:].min()), 2),
            "y": round(float(df["Close"].iloc[y]), 2),
        }
    with open(os.path.join(DATA, "summary.js"), "w") as f:
        f.write("window.NPT_SUMMARY = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print(f"summary.js written for {len(out)} instruments")


def main():
    os.makedirs(CSV_DIR, exist_ok=True)
    for a in sys.argv[1:]:
        if a.startswith("--restore-from="):
            restore_from(a.split("=", 1)[1])
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--update" in sys.argv
    stocks = [a.upper() for a in args] if args else get_symbol_list()
    jobs = [(s, "index" if s in INDICES else "stock") for s in stocks] + ([] if args else [(k, "index") for k in INDICES])
    ok, failed = 0, []
    written = {}
    for i, (sym, kind) in enumerate(jobs, 1):
        fn = sym.replace("&", "_").replace("-", "_")
        jsf = os.path.join(DATA, fn + ".js")
        seed = os.path.exists(jsf) and '"source":"NSE CSV (uploaded)"' in open(jsf).read(300)
        if not force and not seed and os.path.exists(jsf) and time.time() - os.path.getmtime(jsf) < 12 * 3600:
            print(f"[{i}/{len(jobs)}] {sym}: fresh, skipping (use --update to force)")
            ok += 1
            continue
        if kind == "index":
            df, src = from_yahoo(sym, [INDICES[sym]])
        else:
            df, src = from_yahoo(sym, ALIASES.get(sym, [sym + ".NS"]))
            if df is None:
                df, src = from_nse(sym)
        if df is None:
            print(f"[{i}/{len(jobs)}] {sym}: FAILED")
            failed.append(sym)
            continue
        df = clean(df)
        df, carried = keep_newer_days(fn, df)
        write_js(sym, df, src, kind)
        written[sym] = [df, src, kind]
        ok += 1
        note = f" (+{carried} newer day(s) kept from the previous update)" if carried else ""
        print(f"[{i}/{len(jobs)}] {sym}: {len(df)} bars {df['Date'].iloc[0]} -> {df['Date'].iloc[-1]} ({src}){note}")
        time.sleep(0.3)
    # Symbols not re-downloaded this run (skipped as fresh, or failed but restored) can be filled too.
    for sym, kind in jobs:
        fn = sym.replace("&", "_").replace("-", "_")
        if sym not in written:
            old = read_js(os.path.join(DATA, fn + ".js"))
            if old is not None and not old.empty:
                src, k = read_meta(os.path.join(DATA, fn + ".js"))
                written[sym] = [old, src, k]
    try:
        fill_from_nse(written)
    except Exception as e:
        print("Could not fill recent days from NSE:", e)
    write_manifest()
    print(f"Done. {ok} ok, {len(failed)} failed: {failed}")


if __name__ == "__main__":
    main()
