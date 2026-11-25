#!/usr/bin/env python3
"""
Collects company logos for the search bar and stock header.

Run it by hand when you want to refresh logos, review the results, then commit the logos/ folder.
For each symbol it looks up the
company's website (DOMAINS below), fetches that site's icon, keeps it only if it is a real,
reasonably sharp image, and saves it as logos/<SYMBOL>.png (64x64). It then writes
logos/index.js listing which logos exist. Symbols without a logo get an initials badge
in the app, so a missing or failed logo never shows a broken image.

Logos are stored in this repository and served from this site, so visitors' browsers never contact
a third-party logo service, and the daily data update does not depend on any logo website.

Usage:  pip install pillow   then   python fetch_logos.py
"""
import io
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "logos")

# Symbol -> company website. Edit or add entries here; a wrong domain just falls back to initials.
DOMAINS = {
    "ABB": "abb.com", "ADANIENSOL": "adanienergysolutions.com", "ADANIENT": "adanienterprises.com",
    "ADANIGREEN": "adanigreenenergy.com", "ADANIPORTS": "adaniports.com", "ADANIPOWER": "adanipower.com",
    "AMBUJACEM": "ambujacement.com", "APOLLOHOSP": "apollohospitals.com", "ASIANPAINT": "asianpaints.com",
    "AXISBANK": "axisbank.com", "BAJAJ-AUTO": "bajajauto.com", "BAJAJFINSV": "bajajfinserv.in",
    "BAJAJHFL": "bajajhousingfinance.in", "BAJAJHLDNG": "bhil.in", "BAJFINANCE": "bajajfinserv.in",
    "BANKBARODA": "bankofbaroda.in", "BEL": "bel-india.in", "BHARTIARTL": "airtel.in", "BOSCHLTD": "bosch.in",
    "BPCL": "bharatpetroleum.in", "BRITANNIA": "britannia.co.in", "BSE": "bseindia.com", "CANBK": "canarabank.com",
    "CGPOWER": "cgglobal.com", "CHOLAFIN": "cholamandalam.com", "CIPLA": "cipla.com", "COALINDIA": "coalindia.in",
    "CUMMINSIND": "cumminsindia.com", "DABUR": "dabur.com", "DIVISLAB": "divislabs.com", "DLF": "dlf.in",
    "DMART": "dmartindia.com", "DRREDDY": "drreddys.com", "EICHERMOT": "eicher.in", "ENRIN": "siemens-energy.com",
    "ETERNAL": "zomato.com", "GAIL": "gailonline.com", "GODREJCP": "godrejcp.com", "GRASIM": "grasim.com",
    "HAL": "hal-india.co.in", "HAVELLS": "havells.com", "HCLTECH": "hcltech.com", "HDFCAMC": "hdfcfund.com",
    "HDFCBANK": "hdfcbank.com", "HDFCLIFE": "hdfclife.com", "HINDALCO": "hindalco.com", "HINDUNILVR": "hul.co.in",
    "HINDZINC": "hzlindia.com", "HYUNDAI": "hyundai.com", "ICICIBANK": "icicibank.com", "ICICIGI": "icicilombard.com",
    "ICICIPRULI": "iciciprulife.com", "IDEA": "myvi.in", "INDHOTEL": "ihcltata.com", "INDIGO": "goindigo.in",
    "INFY": "infosys.com", "IOC": "iocl.com", "IRFC": "irfc.co.in", "ITC": "itcportal.com",
    "JINDALSTEL": "jindalsteelpower.com", "JIOFIN": "jiofinancialservices.com", "JSWENERGY": "jsw.in",
    "JSWSTEEL": "jsw.in", "KOTAKBANK": "kotak.com", "LICI": "licindia.in", "LODHA": "lodhagroup.com",
    "LT": "larsentoubro.com", "LTIM": "ltimindtree.com", "LTM": "ltimindtree.com", "M&M": "mahindra.com",
    "MARUTI": "marutisuzuki.com", "MAXHEALTH": "maxhealthcare.in", "MAZDOCK": "mazagondock.in",
    "MOTHERSON": "motherson.com", "MUTHOOTFIN": "muthootfinance.com", "NAUKRI": "infoedge.in",
    "NESTLEIND": "nestle.in", "NTPC": "ntpc.co.in", "ONGC": "ongcindia.com", "PFC": "pfcindia.com",
    "PIDILITIND": "pidilite.com", "PNB": "pnbindia.in", "POLYCAB": "polycab.com", "POWERGRID": "powergrid.in",
    "POWERINDIA": "hitachienergy.com", "RECLTD": "recindia.nic.in", "RELIANCE": "ril.com", "SBILIFE": "sbilife.co.in",
    "SBIN": "sbi.co.in", "SHREECEM": "shreecement.com", "SHRIRAMFIN": "shriramfinance.in", "SIEMENS": "siemens.com",
    "SOLARINDS": "solargroup.com", "SUNPHARMA": "sunpharma.com", "SWIGGY": "swiggy.com", "TATACAP": "tatacapital.com",
    "TATACONSUM": "tataconsumer.com", "TATAMOTORS": "tatamotors.com", "TATAPOWER": "tatapower.com",
    "TATASTEEL": "tatasteel.com", "TCS": "tcs.com", "TECHM": "techmahindra.com", "TITAN": "titancompany.in",
    "TMCV": "tatamotors.com", "TMPV": "tatamotors.com", "TORNTPHARM": "torrentpharma.com",
    "TRENT": "trentlimited.com", "TVSMOTOR": "tvsmotor.com", "ULTRACEMCO": "ultratechcement.com",
    "UNIONBANK": "unionbankofindia.co.in", "UNITDSPR": "diageoindia.com", "VBL": "varunbeverages.com",
    "VEDL": "vedantalimited.com", "WIPRO": "wipro.com", "ZYDUSLIFE": "zyduslife.com",
}

SOURCES = [
    "https://www.google.com/s2/favicons?domain={d}&sz=128",
    "https://icon.horse/icon/{d}",
    "https://www.{d}/apple-touch-icon.png",
    "https://www.{d}/favicon.ico",
    "https://icons.duckduckgo.com/ip3/{d}.ico",
]

# Logos checked by hand and rejected (blurry or not the company's real logo): these show initials.
SKIP = {"TATAPOWER", "SHRIRAMFIN", "LODHA", "GODREJCP", "CGPOWER", "SBILIFE", "TORNTPHARM", "VBL",
        "JINDALSTEL", "DMART", "HINDZINC"}
MIN_SIZE = 32  # icons smaller than this look blurry; fall back to initials instead


def file_name(sym):
    return sym.replace("&", "_").replace("-", "_")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        if r.status != 200:
            return None
        return r.read()


PLACEHOLDER = None  # corner colour of icon.horse's "letter on grey" fallback image, detected at start


def is_placeholder(im):
    """icon.horse returns a grey square with a letter when it has no logo; reject those."""
    if PLACEHOLDER is None:
        return False
    px = im.convert("RGB").getpixel((2, 2))
    if max(abs(a - b) for a, b in zip(px, PLACEHOLDER)) > 6:
        return False
    small = im.convert("RGB").resize((24, 24))
    sat = [max(px) - min(px) for px in (small.getpixel((x, y)) for x in range(24) for y in range(24))]
    return max(sat) < 25  # grey-only image with the placeholder background


def to_logo(raw):
    """Return a 64x64 PNG (bytes) if raw is a usable image, else None."""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(raw))
        if im.format == "ICO":
            # .ico files can hold several sizes; use the largest one
            try:
                im = im.ico.getimage(max(im.ico.sizes(), key=lambda s: s[0] * s[1]))
            except Exception:
                pass
        im = im.convert("RGBA")
    except Exception:
        return None
    if min(im.size) < MIN_SIZE or is_placeholder(im):
        return None
    # Reject blank / single-colour images (generic placeholders)
    colours = im.resize((24, 24)).getcolors(24 * 24)
    if colours is not None and len(colours) < 3:
        return None
    im.thumbnail((64, 64), Image.LANCZOS)
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas.paste(im, ((64 - im.width) // 2, (64 - im.height) // 2), im)
    out = io.BytesIO()
    canvas.save(out, "PNG", optimize=True)
    return out.getvalue()


def main():
    global PLACEHOLDER
    os.makedirs(OUT, exist_ok=True)
    try:  # learn what icon.horse's fallback looks like by asking for a site that doesn't exist
        from PIL import Image
        ph = Image.open(io.BytesIO(fetch("https://icon.horse/icon/no-such-company-zq81x.com"))).convert("RGB")
        PLACEHOLDER = ph.getpixel((2, 2))
        print("icon.horse placeholder colour:", PLACEHOLDER)
    except Exception as e:
        print("could not sample icon.horse placeholder:", e)
    have, cache = [], {}
    for sym, domain in DOMAINS.items():
        if sym in SKIP:
            print(f"  {sym}: skipped (rejected on review), app will show initials")
            continue
        png = cache.get(domain)
        if png is None and domain not in cache:
            for src in SOURCES:
                try:
                    raw = fetch(src.format(d=domain))
                    png = to_logo(raw) if raw else None
                except Exception:
                    png = None
                if png:
                    break
                time.sleep(0.2)
            cache[domain] = png
        if png:
            with open(os.path.join(OUT, file_name(sym) + ".png"), "wb") as f:
                f.write(png)
            have.append(sym)
            print(f"  {sym}: ok ({domain})")
        else:
            print(f"  {sym}: no usable logo ({domain}), app will show initials")
    with open(os.path.join(OUT, "index.js"), "w") as f:
        f.write("window.NPT_LOGOS = " + json.dumps(sorted(have)) + ";\n")
    print(f"Logos: {len(have)} of {len(DOMAINS)} saved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
