# Project brief — Warframe Riven Calculator

## Goal
Static web app (English UI) to grade Warframe riven mods, find the best stats per weapon and simulate cycling, Trait Locking (U44) and Riven Splicers (U44.1).

## Decisions (developer grilling)
- Static site, no backend; GitHub Pages via GitHub Actions (test → build → deploy on `main`).
- Vite + React + TypeScript; pure logic in `src/core` (no React), tested with Vitest.
- Manual riven input (OCR later). Weapon data: WFCD `warframe-items` snapshot in `src/data/weapons.json`, refreshed with `npm run update-data`.
- Uncertain game constants live only in `src/core/mechanics.ts`, each with source and `verified` flag; unverified ones are listed in the UI footer.
- Out of MVP: OCR, market prices, custom builds, accounts. Saved rivens in localStorage only.

## Grading
- **Weapon grade** (main): position of the value in the weapon-wide range = base × disposition × every configuration (3+0 min … 2+1 max) × roll 0.9–1.1. Letters S ≥ 90%, A ≥ 75%, B ≥ 55%, C ≥ 35%, D ≥ 15%, F. Curses: smaller is better.
- **Roll grade** (secondary): roll inside the riven's own configuration.
- **Score 0–100**: gain over a reference build per class = 75% burst DPS + 25% sustained DPS (mag/reload) + utility weights, normalized on the theoretical godroll of the same weapon. Curses are not penalized per se: only their real impact counts (harmless curses ≈ 0).
- Faction stats count at 50% (one faction only). Labels: Godroll ≥ 85, Great ≥ 65, Usable ≥ 45, else Roll for kuva (disposition ≥ 0.9 or curated weapon) / Trash.

## Domain requirements
- *Riven trader*: generated riven name, market-style labels, harmless/bad curse verdict, rank 0–8 input scaled to max, reroll count drives kuva cost.
- *Theorycrafter*: burst + sustained DPS, simple declared status model (status weight 0.6 per proc/pellet), faction at half value, melee simplified model with range/combo as utility, curated overrides for ~30 meta weapons (`src/data/overrides.json`).

## Expert review (adopted)
- QA: golden tests vs wiki numbers; exact odds cross-checked by Monte Carlo with fixed seed.
- Performance: exact enumeration for odds (no sampling needed); Monte Carlo verification in a Web Worker with seeded PRNG.
- UX: fuzzy weapon search, stats filtered by weapon, values as shown in game, colored grades + range bar, saved rivens.
- Architecture: `data/` JSON → `core/` pure functions → `ui/` React.

## Open / later
- Verify: configuration odds (25% each), uniform roll distribution, whether a locked trait keeps its value, kitgun riven value column (pistol assumed).
- Custom build input, OCR, warframe.market prices, companion weapon rivens.
