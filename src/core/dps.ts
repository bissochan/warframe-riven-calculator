// Simplified damage model used to value riven stats. It is deliberately small and
// declared: the goal is ranking stats on a given weapon, not exact in-game numbers.
import { FACTION_STATS } from './stats';
import type { StatClass, Weapon } from './types';

/** Bonuses as fractions (1.5 = +150%), keyed by stat id. */
export type Bonuses = Record<string, number>;

/** Typical endgame mods per class (additive with riven bonuses). */
export const REFERENCE_BUILDS: Record<StatClass, { label: string; bonuses: Bonuses }> = {
  rifle: {
    label: 'Serration, Split Chamber, Point Strike, Vital Sense, 2 × 90% elemental',
    bonuses: { damage: 1.65, multishot: 0.9, cc: 1.5, cd: 1.2, elemental: 1.8 },
  },
  shotgun: {
    label: 'Primed Point Blank, Hell\'s Chamber, Blunderbuss, Ravage, 2 × 90% elemental',
    bonuses: { damage: 1.65, multishot: 1.2, cc: 0.9, cd: 0.6, elemental: 1.8 },
  },
  pistol: {
    label: 'Hornet Strike, Barrel Diffusion, Pistol Gambit, Primed Target Cracker, 2 × 90% elemental',
    bonuses: { damage: 2.2, multishot: 1.2, cc: 1.2, cd: 1.1, elemental: 1.8 },
  },
  archgun: {
    label: 'Primed Rubedo-Lined Barrel, Dual Rounds, Parallax Scope, Hollowed Bullets, 2 × elemental',
    bonuses: { damage: 1.65, multishot: 0.6, cc: 0.6, cd: 0.6, elemental: 1.2 },
  },
  melee: {
    label: 'Primed Pressure Point, Blood Rush (avg.), Organ Shatter, Berserker Fury, 2 × 90% elemental',
    bonuses: { damage: 1.65, cc: 1.65, cd: 0.9, fireRate: 0.35, elemental: 1.8 },
  },
};

/** Fallback stats for modular parts without base stats (Zaw strikes, Kitgun chambers). */
const GENERIC: Record<StatClass, Partial<Weapon>> = {
  rifle: { cc: 0.25, cd: 2.2, sc: 0.25, fireRate: 8, multishot: 1, magazine: 40, reload: 2 },
  shotgun: { cc: 0.2, cd: 2, sc: 0.3, fireRate: 2, multishot: 8, magazine: 8, reload: 2.5 },
  pistol: { cc: 0.25, cd: 2.2, sc: 0.25, fireRate: 5, multishot: 1, magazine: 20, reload: 1.6 },
  archgun: { cc: 0.25, cd: 2.2, sc: 0.25, fireRate: 6, multishot: 1, magazine: 100, reload: 3 },
  melee: { cc: 0.25, cd: 2.2, sc: 0.25, fireRate: 1, multishot: 1, magazine: 0, reload: 0 },
};

export function effectiveWeapon(w: Weapon): Weapon {
  if (w.hasStats) return w;
  return { ...w, ...GENERIC[w.statClass], totalDamage: 100, impact: 34, puncture: 33, slash: 33 } as Weapon;
}

/** Share of hits assumed to land on weakpoints (for the spliced weakpoint stats). */
export const WEAKPOINT_SHARE = 0.3;
/** How much a guaranteed status proc per pellet is worth in damage (viral/slash/heat stacking proxy). */
export const STATUS_WEIGHT = 0.6;
/** Faction stats only apply against one faction: they count at this weight in the global score. */
export const FACTION_WEIGHT = 0.5;

const ELEMENTAL_RIVEN = ['heat', 'cold', 'electricity', 'toxin', 'gas', 'corrosive', 'viral', 'radiation', 'blast', 'magnetic'];

export interface DpsResult {
  burst: number;
  sustained: number;
}

export function dps(weapon: Weapon, riven: Bonuses, build: Bonuses = REFERENCE_BUILDS[weapon.statClass].bonuses): DpsResult {
  const w = effectiveWeapon(weapon);
  const b = (k: string) => (build[k] ?? 0) + (riven[k] ?? 0);
  const r = (k: string) => riven[k] ?? 0;
  const total = w.totalDamage || 100;

  const damage = Math.max(0, 1 + b('damage'));
  let elemental = build.elemental ?? 0;
  for (const e of ELEMENTAL_RIVEN) elemental += r(e);
  const physical = (w.impact * r('impact') + w.puncture * r('puncture') + w.slash * r('slash')) / total;
  const perHit = total * damage * Math.max(0, 1 + elemental + physical);

  const cd = Math.max(1, w.cd * (1 + b('cd')));
  const cc = Math.max(0, w.cc * (1 + b('cc')));
  const ccWeak = Math.max(0, w.cc * (1 + b('cc') + r('wpCC')));
  const crit = (1 - WEAKPOINT_SHARE) * (1 + cc * (cd - 1)) + WEAKPOINT_SHARE * (1 + ccWeak * (cd - 1));
  const weakpoint = 1 + WEAKPOINT_SHARE * r('wpDamage');

  const multishot = w.statClass === 'melee' ? 1 : Math.max(0, w.multishot * (1 + b('multishot')));
  const fireRate = Math.max(0.05, w.fireRate * (1 + b('fireRate')));
  const sc = Math.max(0, w.sc * (1 + b('sc')));
  const status = 1 + STATUS_WEIGHT * Math.min(sc, 1) * (1 + r('statusDamage'));
  let faction = 1;
  for (const f of FACTION_STATS) faction += FACTION_WEIGHT * r(f);
  faction = Math.max(0, faction);

  const burst = perHit * crit * weakpoint * multishot * fireRate * status * faction;
  if (w.statClass === 'melee' || w.magazine <= 0 || w.reload <= 0) return { burst, sustained: burst };

  const ammoEff = Math.min(0.9, Math.max(0, r('ammoEfficiency')));
  const mag = Math.max(1, (w.magazine * (1 + b('magazine'))) / (1 - ammoEff));
  const reload = w.reload / Math.max(0.1, 1 + b('reload'));
  const firing = mag / fireRate;
  return { burst, sustained: (burst * firing) / (firing + reload) };
}
