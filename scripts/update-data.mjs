// Downloads the WFCD warframe-items dataset and writes a compact snapshot
// (only what the riven calculator needs) to src/data/weapons.json.
// Usage: npm run update-data
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/';
const FILES = ['Primary', 'Secondary', 'Melee', 'Arch-Gun', 'Misc'];
const CACHE = path.resolve('.cache');
const OUT = path.resolve('src/data/weapons.json');

// Modular weapons: only the part that owns the riven disposition.
const ZAW_STRIKES = ['Balla', 'Cyath', 'Dehtat', 'Dokrahm', 'Kronsh', 'Mewan', 'Ooltha', 'Rabvee', 'Sepfahn', 'Plague Keewar', 'Plague Kripath'];
const KITGUN_CHAMBERS = ['Catchmoon', 'Gaze', 'Rattleguts', 'Tombfinger', 'Sporelacer', 'Vermisplicer'];

const ELEMENTS = ['heat', 'cold', 'electricity', 'toxin', 'blast', 'radiation', 'gas', 'magnetic', 'viral', 'corrosive', 'void', 'tau'];
const round = (n, d = 4) => (typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : 0);

async function load(name) {
  const file = path.join(CACHE, `${name}.json`);
  if (!process.argv.includes('--cached') || !existsSync(file)) {
    const res = await fetch(`${BASE}${name}.json`);
    if (!res.ok) throw new Error(`Download failed for ${name}: ${res.status}`);
    await writeFile(file, await res.text());
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

function rivenType(w, file) {
  if (file === 'Arch-Gun') return 'archgun';
  if (file === 'Melee') {
    if (w.type !== 'Zaw Component') return 'melee';
    return ZAW_STRIKES.includes(w.name) ? 'zaw' : null;
  }
  if (file === 'Secondary') return 'pistol';
  if (file === 'Primary') {
    if (w.productCategory !== 'LongGuns') return null;
    return w.type === 'Shotgun' ? 'shotgun' : 'rifle';
  }
  if (file === 'Misc' && w.type === 'Kitgun Component' && KITGUN_CHAMBERS.includes(w.name)) return 'kitgun';
  return null;
}

// Which column of the riven base-value table a riven type uses.
const STAT_CLASS = { rifle: 'rifle', shotgun: 'shotgun', pistol: 'pistol', archgun: 'archgun', melee: 'melee', zaw: 'melee', kitgun: 'pistol' };

function dots(d) {
  if (d >= 1.31) return 5;
  if (d >= 1.11) return 4;
  if (d >= 0.9) return 3;
  if (d >= 0.7) return 2;
  return 1;
}

function compact(w, type) {
  const dmg = w.damage ?? {};
  const elements = {};
  for (const e of ELEMENTS) if (dmg[e] > 0) elements[e] = round(dmg[e], 2);
  const total = round(dmg.total ?? w.totalDamage ?? 0, 2);
  const hasStats = total > 0 && (w.fireRate ?? 0) > 0;
  const attack = (w.attacks ?? [])[0] ?? {};
  return {
    name: w.name,
    type,
    statClass: STAT_CLASS[type],
    subtype: w.type,
    disposition: round(w.omegaAttenuation ?? 1, 3),
    dots: dots(w.omegaAttenuation ?? 1),
    hasStats,
    cc: round(w.criticalChance),
    cd: round(w.criticalMultiplier),
    sc: round(w.procChance),
    fireRate: round(w.fireRate),
    multishot: round(w.multishot ?? 1, 2) || 1,
    magazine: w.magazineSize ?? 0,
    reload: round(w.reloadTime ?? 0, 2),
    totalDamage: total,
    impact: round(dmg.impact, 2),
    puncture: round(dmg.puncture, 2),
    slash: round(dmg.slash, 2),
    elements,
    projectile: attack.shot_type === 'Projectile' || ['Bow', 'Launcher', 'Throwing'].includes(w.type),
    wikiUrl: w.wikiaUrl ?? null,
  };
}

await mkdir(CACHE, { recursive: true });
const seen = new Set();
const weapons = [];
for (const file of FILES) {
  for (const w of await load(file)) {
    const type = rivenType(w, file);
    if (!type || seen.has(w.name)) continue;
    if (w.type === 'Exalted Weapon') continue;
    seen.add(w.name);
    weapons.push(compact(w, type));
  }
}
weapons.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: 'WFCD/warframe-items', weapons }, null, 0));
console.log(`Wrote ${weapons.length} weapons to ${path.relative(process.cwd(), OUT)}`);
