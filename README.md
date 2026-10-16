# Warframe Riven Calculator

Grade Warframe riven mods against every roll their weapon can have, see the best stats for each weapon, and simulate cycling, Trait Locking and Riven Splicers.

## Features
- **Per-stat grades**: where each value sits in the weapon-wide range (disposition × all buff/curse configurations × 90–110% roll), plus the roll inside the riven's own configuration.
- **Riven score (0–100)**: DPS gain on a reference build + utility, normalized on the weapon's theoretical godroll. Labels: Godroll / Great / Usable / Roll for kuva / Trash, with a curse verdict.
- **Best stats per weapon**: stat ranking, least harmful curses, godroll, curated community picks.
- **Cycle & splice simulator**: kuva costs (doubled with a trait lock), Riven Splicer recipes (U44.1).
- **Kuva planner**: exact odds of hitting a target riven, expected cycles/kuva and 50%/90% percentiles, with/without lock, verified by Monte Carlo.

## Development
```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (core logic)
npm run build        # production build
npm run update-data  # refresh weapon data from WFCD warframe-items
```
Copy `.env.example` to `.env` and set `VITE_BASE_PATH` (`/` locally). The GitHub Actions workflow sets it to `/<repo>/` for GitHub Pages; enable Pages with source "GitHub Actions" in the repository settings.

## Structure
- `src/core/` — pure logic: `stats.ts` (attribute table), `mechanics.ts` (all game constants with sources), `riven.ts` (ranges, grades, names), `dps.ts` (damage model), `evaluate.ts` (score, godroll), `cycle.ts` (cycling, lock, splice), `probability.ts` (odds, kuva, Monte Carlo).
- `src/data/` — `weapons.json` (generated) and `overrides.json` (curated community picks, edit freely).
- `src/ui/` — React components.

Game constants that are not confirmed are flagged `verified: false` in `mechanics.ts` and listed in the app footer.

Fan-made tool, not affiliated with Digital Extremes. Warframe is a trademark of Digital Extremes Ltd.
