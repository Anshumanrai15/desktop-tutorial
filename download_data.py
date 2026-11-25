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

The constituent list is pulled live from NSE archives when reachable; otherwise the
built-in list below is used. Edit symbols.txt (one NSE symbol per line) to use your own list.
"""
import io
import json
import os
import sys
import time
from datetime import date

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
            df = yf.Ticker(code).history(period="max", interval="1d", auto_adjust=True, actions=False)
            if df is not None and len(df) > 20:
                df = df.reset_index()
                df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None).dt.strftime("%Y-%m-%d")
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
        if f.endswith(".js") and f not in ("manifest.js",):
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


def main():
    os.makedirs(CSV_DIR, exist_ok=True)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--update" in sys.argv
    stocks = [a.upper() for a in args] if args else get_symbol_list()
    jobs = [(s, "index" if s in INDICES else "stock") for s in stocks] + ([] if args else [(k, "index") for k in INDICES])
    ok, failed = 0, []
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
        write_js(sym, df, src, kind)
        ok += 1
        print(f"[{i}/{len(jobs)}] {sym}: {len(df)} bars {df['Date'].iloc[0]} -> {df['Date'].iloc[-1]} ({src})")
        time.sleep(0.3)
    write_manifest()
    print(f"Done. {ok} ok, {len(failed)} failed: {failed}")


if __name__ == "__main__":
    main()
