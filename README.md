# Lunar Landing Site Navigator

A NASA Space Apps Challenge 2026 project for the [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge.

It compares lunar landing sites and dates in seconds. For any site and time, the app shows where the **Sun** and **Earth** sit relative to the **real terrain horizon**. From that it derives power windows, direct-to-Earth link windows, countdowns to sunset and Earthset, and a calendar of viable landing dates when a schedule slips.

## Why terrain matters
At the lunar south pole the Sun skims the horizon. It is often less than 2° high. A 1° ridge decides whether a lander has power at all. Tools that treat the Moon as a smooth sphere get this wrong, so every visibility number here is measured against a horizon traced from **LRO LOLA laser altimetry**.

## Features
- **Site explorer:**
  - 17 curated sites: Artemis III candidates, CLPS landers, Apollo, Chandrayaan-3, SLIM, Chang'e 4.
  - Custom coordinates, or click anywhere on the south polar map.
  - 360° sky panorama, live metrics, timeline and play-back.
- **Compare:** several site/date scenarios side by side, aligned by days since landing.
- **Slip analyzer:** a calendar heatmap of landing days that meet the user's constraints (continuous sun after touchdown, Earth-link percentage, mission length), plus "if we slip a month".
- **Method & validation:** the numbers behind the claims (below).

## Validation
| Check | Result |
|---|---|
| Our Sun/Earth az/el vs JPL Horizons topocentric az/el, 5 sites, Nov 2026 | max error **0.006°** |
| Sunlit and Earth-visible % vs LOLA team maps (Mazarico et al. 2011), 7 polar sites | within **1–7 percentage points** |
| Chandrayaan-3 2023: predicted local sunset at the landing site | **2023-09-04 07:20 UTC**. ISRO put Vikram to sleep about 5 h earlier, "ahead of the lunar night" |

## Repository layout
```
pipeline/   Python: fetch NASA data, build compact app data, run validations
web/        React + TypeScript + Vite static web app (no backend needed)
web/public/data/  generated data (ephemeris, horizon masks, DEMs, validation)
PLAN.md     team plan
```

## Run it
```bash
cd web && npm install && npm run dev
```

To rebuild the data (downloads about 200 MB of NASA files into `pipeline/raw/`, which is gitignored):
```bash
cd pipeline
python -m venv .venv && .venv/Scripts/pip install numpy requests rasterio pyproj
# DEMs: LDEM_75S_240M.IMG/.LBL and LDEM_16.IMG/.LBL from http://imbrium.mit.edu/DATA/LOLA_GDR/
#       AVGVISIB_75S_120M_201608.TIF and AVGVISIB_75S_120M_201608_EARTH.TIF from https://pgda.gsfc.nasa.gov/data/MoonIllumination/
.venv/Scripts/python fetch_ephemeris.py       # JPL Horizons -> ephem.bin
.venv/Scripts/python horizon_mask.py          # LOLA -> sites.json, browser DEMs
.venv/Scripts/python export_overlays.py       # PGDA maps -> polar overlays
.venv/Scripts/python validate_ephemeris.py    # vs Horizons topocentric
.venv/Scripts/python validate_illumination.py # vs PGDA maps
.venv/Scripts/python validate_missions.py     # Chandrayaan-3 check
```

## NASA data used
- **JPL Horizons System** API (DE441): sub-Earth and sub-solar points on the Moon, hourly for 2023–2031, in the MOON_ME frame.
- **LRO LOLA** gridded topography: `LDEM_75S_240M`, `LDEM_16` (NASA PDS Geosciences / LOLA data node).
- **LOLA polar illumination products** (PGDA, NASA GSFC): average Sun and Earth visibility, used for the map overlays and validation (Mazarico et al. 2011, *Icarus* 211).
- Landing-site coordinates come from LROC, NASA Apollo records and Artemis III site studies. The source of each site is shown in the app; sites marked "verify" still need a primary-source check.

## Use of AI
The team designed the concept, method and features. We used an AI coding assistant (Claude) to help write and debug code in `pipeline/` and `web/`, and to search documentation for data formats. Every number shown in the app is computed from the NASA data above and checked against independent NASA references (see Validation). No AI-generated images, audio or video are used.

## License
MIT (code). NASA data is public domain; cite the sources above.
