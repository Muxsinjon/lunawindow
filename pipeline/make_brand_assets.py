"""Render the Open Graph image (1200x630) and PNG favicons from hand-written SVG.

Original artwork: the real LOLA horizon silhouette of Nobile Rim 2 with the Sun on the ridge.
No agency logos, no AI-generated imagery. Requires `playwright` (Chromium).
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "web" / "public"
sites = json.loads((PUB / "data" / "sites.json").read_text())
site = next(s for s in sites["sites"] if s["id"] == "nobile-rim-2")
mask = site["horizon"]

W, H = 1200, 630
lo, hi = -4.0, 12.0
top, bottom = 150, 560


def y(el):
    return top + (hi - el) / (hi - lo) * (bottom - top)


pts = " ".join(f"{i / len(mask) * W:.1f},{y(h):.1f}" for i, h in enumerate(mask))
terrain = f"M0,{H} L{pts} L{W},{y(mask[0]):.1f} L{W},{H} Z"
sun_i = 653  # azimuth 326.5 deg, where the Sun sets behind the ridge on 2026-11-22
sun_x, sun_y = sun_i / len(mask) * W, y(mask[sun_i]) - 4

og = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600&family=Barlow:wght@400;500&display=swap" rel="stylesheet">
<style>html,body{{margin:0;width:{W}px;height:{H}px;background:#1b1f25;overflow:hidden}}
h1{{position:absolute;left:64px;top:56px;margin:0;font:600 64px 'Barlow Semi Condensed';color:#ece9e2;letter-spacing:.005em}}
p{{position:absolute;left:66px;top:136px;margin:0;font:400 28px Barlow;color:#a9a69e;max-width:760px}}
.f{{position:absolute;left:66px;bottom:34px;font:500 22px Barlow;color:#ece9e2}}</style></head><body>
<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;inset:0">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12161c"/><stop offset="1" stop-color="#2a3646"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e5a53"/><stop offset="1" stop-color="#2e2c29"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="url(#s)"/>
<line x1="0" x2="{W}" y1="{y(0):.1f}" y2="{y(0):.1f}" stroke="#ece9e2" stroke-opacity=".28" stroke-dasharray="6 6"/>
<circle cx="{sun_x:.1f}" cy="{sun_y:.1f}" r="40" fill="#f0a830" opacity=".18"/>
<circle cx="{sun_x:.1f}" cy="{sun_y:.1f}" r="16" fill="#f0a830"/>
<circle cx="{sun_x - 120:.1f}" cy="{y(8.6):.1f}" r="22" fill="#5ab0f0"/>
<path d="{terrain}" fill="url(#g)" stroke="#9a948a" stroke-width="2"/>
</svg>
<h1>Lunar Landing Site Navigator</h1>
<p>When does a landing site get sunlight and a line to Earth? Real LOLA terrain, JPL Horizons ephemerides.</p>
<div class="f">Nobile Rim 2: the Sun sets 6.4° above a flat horizon, behind this ridge.</div>
</body></html>"""

icon = (PUB / "favicon.svg").read_text()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.set_content(og, wait_until="networkidle")
    pg.screenshot(path=str(PUB / "og-image.png"))
    for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png")):
        pg = b.new_page(viewport={"width": size, "height": size})
        sized = icon.replace("<svg ", '<svg width="%d" height="%d" ' % (size, size))
        pg.set_content("<html><body style='margin:0;background:transparent'>" + sized + "</body></html>")
        pg.screenshot(path=str(PUB / name), omit_background=True)
    b.close()
print("wrote og-image.png, favicon-32.png, apple-touch-icon.png")
