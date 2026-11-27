"""Checks that the live website has the latest closing prices published by NSE.

    python check_fresh.py check   -> writes stale=true/false for the workflow (never fails)
    python check_fresh.py verify  -> exits with an error if the live site is behind NSE

"Latest" means the newest trading day for which NSE has published its official end-of-day
file (the bhavcopy), so market holidays and weekends are handled automatically.
Standard library only, so it runs in seconds without installing anything.
"""
import collections
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
BHAV = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{}_F_0000.csv.zip"
SITE = os.environ.get("SITE_URL", "https://anshumanrai15.github.io/paperpaisaa/").rstrip("/") + "/"


def fetch(url, method="GET", tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "Mozilla/5.0", "Accept": "*/*",
                                                                       "Referer": "https://www.nseindia.com/"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, (r.read() if method == "GET" else b"")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, b""
        except Exception as e:  # network hiccup: retry
            print(f"  ({url}: {e})")
        time.sleep(3 * (k + 1))
    return None, b""


def newest_nse_day():
    """Newest weekday (within the last 10 days) whose bhavcopy NSE has published, or None if NSE can't be reached."""
    today = datetime.now(IST).date()
    reached = False
    for back in range(0, 11):
        d = today - timedelta(days=back)
        if d.weekday() >= 5:
            continue
        code, _ = fetch(BHAV.format(d.strftime("%Y%m%d")), method="HEAD")
        if code == 405:   # HEAD not allowed: fall back to GET
            code, _ = fetch(BHAV.format(d.strftime("%Y%m%d")))
        if code is not None:
            reached = True
        if code == 200:
            return d.isoformat()
    return None if not reached else "none-in-10-days"


def live_dates():
    code, body = fetch(SITE + "data/summary.js?nocache=" + str(int(time.time())))
    if code != 200:
        return None
    return dict(re.findall(r'"([A-Z0-9&_-]+)":\{"d":"(\d{4}-\d\d-\d\d)"', body.decode("utf-8", "replace")))


def status():
    nse = newest_nse_day()
    live = live_dates()
    if not live:
        return {"stale": True, "reason": "could not read the live site's prices", "nse": nse, "live": None, "behind": []}
    common = collections.Counter(live.values()).most_common(1)[0][0]
    if nse in (None, "none-in-10-days"):
        # Can't ask NSE: rebuild anyway if the site is missing the previous weekday (a rebuild is harmless).
        d = datetime.now(IST).date() - timedelta(days=1)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
        return {"stale": common < d.isoformat(), "unknown": True, "reason": "could not reach NSE to compare", "nse": nse, "live": common, "behind": []}
    behind = sorted(s for s, d in live.items() if d < nse)
    # A few stocks can legitimately miss a day (suspended or not traded); the site is stale if most are behind.
    stale = len(behind) > 0.1 * len(live)
    return {"stale": stale, "nse": nse, "live": common, "behind": behind, "count": len(live),
            "reason": f"{len(behind)} of {len(live)} instruments are older than {nse}" if behind else "up to date"}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    st = status()
    print(json.dumps({k: v for k, v in st.items() if k != "behind"}, indent=1))
    if st["behind"]:
        print("Behind:", ", ".join(st["behind"][:30]))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"stale={'true' if st['stale'] else 'false'}\nnse={st.get('nse') or ''}\nlive={st.get('live') or ''}\n")
    if mode == "verify":
        if st["stale"] and not st.get("unknown"):
            print(f"::error::Live prices are NOT up to date: {st['reason']} (site has {st['live']}, NSE has {st['nse']}).")
            sys.exit(1)
        if st.get("unknown"):
            print(f"::warning::{st['reason']}; the site has prices up to {st['live']}.")
        else:
            print(f"OK: the live site has NSE's latest prices ({st['nse']}).")


if __name__ == "__main__":
    main()
