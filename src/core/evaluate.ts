// Riven scoring: DPS gain from the damage model + utility weights + community overrides,
// normalized against the theoretical godroll of the same weapon.
import overridesJson from '../data/overrides.json';
import { CONFIGS } from './mechanics';
import { dps, type Bonuses } from './dps';
import { globalRange, magnitude, rivenConfig, dispositionOf, statPool, type Sign } from './riven';
import { getStat } from './stats';
import type { Config, Riven, RivenStat, Weapon } from './types';

export interface WeaponOverride {
  preferred?: string[];
  harmlessCurses?: string[];
  utility?: Record<string, number>;
  note?: string;
}

const OVERRIDES = overridesJson as unknown as Record<string, WeaponOverride>;
export const getOverride = (weapon: Weapon): WeaponOverride | undefined => OVERRIDES[weapon.name];

/** Burst vs sustained DPS weight in the score. */
export const BURST_WEIGHT = 0.75;
/** Extra gain (at max roll) for a stat the community prefers, as a share of the weapon's +Damage gain. */
export const PREFERRED_BONUS = 0.35;

const referenceCache = new Map<string, number>();
/** Gain of a max-roll +Damage on a 3+1 riven: the yardstick for override bonuses. */
function referenceGain(weapon: Weapon, disposition: number): number {
  const key = `${weapon.name}@${disposition}`;
  let g = referenceCache.get(key);
  if (g === undefined) {
    const base = dps(weapon, {});
    const m = magnitude('damage', 'buff', 1.1, { buffs: 3, curse: true }, weapon, disposition) / 100;
    const d = dps(weapon, { damage: m });
    g = BURST_WEIGHT * (d.burst / base.burst - 1) + (1 - BURST_WEIGHT) * (d.sustained / base.sustained - 1);
    referenceCache.set(key, g);
  }
  return g;
}

/**
 * Value of non-damage stats, as DPS-equivalent gain at the weapon's max global roll.
 * Curses use the negative weight (harm at max curse magnitude).
 */
export function utilityWeights(weapon: Weapon): Record<string, { buff: number; curse: number }> {
  const sniper = weapon.subtype === 'Sniper';
  const u: Record<string, { buff: number; curse: number }> = {
    punch: { buff: 0.06, curse: 0 },
    ammo: { buff: 0.03, curse: -0.05 },
    projSpeed: { buff: 0.04, curse: -0.06 },
    zoom: { buff: sniper ? 0.03 : 0, curse: sniper ? -0.04 : 0 },
    recoil: { buff: 0.01, curse: -0.01 },
    sd: { buff: 0.03, curse: -0.02 },
    range: { buff: 0.5, curse: -0.25 },
    comboDuration: { buff: 0.04, curse: -0.04 },
    initialCombo: { buff: 0.08, curse: 0 },
    slideCC: { buff: 0.04, curse: -0.01 },
    finisher: { buff: 0.01, curse: 0 },
    heavyEfficiency: { buff: 0.05, curse: -0.03 },
    comboChance: { buff: 0.08, curse: 0 },
    comboGain: { buff: 0, curse: -0.03 },
    holsterReload: { buff: 0.03, curse: 0 },
    parry: { buff: 0.01, curse: 0 },
    slam: { buff: 0.02, curse: 0 },
    heavyDamage: { buff: 0.06, curse: 0 },
    heavyWindup: { buff: 0.05, curse: 0 },
  };
  for (const [id, w] of Object.entries(getOverride(weapon)?.utility ?? {})) {
    u[id] = { buff: w, curse: u[id]?.curse ?? -w / 2 };
  }
  return u;
}

interface ScoringStat {
  id: string;
  kind: 'buff' | 'curse' | 'spliced';
  /** Magnitude in display units (always positive). */
  magnitude: number;
}

export interface GainBreakdown {
  total: number;
  burst: number;
  sustained: number;
  utility: number;
  perStat: Record<string, number>;
}

function bonuses(stats: ScoringStat[], weapon: Weapon, harmless: Set<string>): Bonuses {
  const b: Bonuses = {};
  for (const s of stats) {
    if (s.kind === 'curse' && harmless.has(s.id)) continue;
    const def = getStat(s.id);
    if (def.unit !== '%' && def.unit !== 'x') continue;
    b[s.id] = ((s.kind === 'curse' ? -1 : 1) * s.magnitude) / 100;
  }
  if (weapon.statClass === 'melee') delete b.multishot;
  return b;
}

/** Score-relevant gain of a set of stats on a weapon (0 = no riven). */
export function gain(stats: ScoringStat[], weapon: Weapon, disposition = weapon.disposition): GainBreakdown {
  const ov = getOverride(weapon);
  const harmless = new Set(ov?.harmlessCurses ?? []);
  const preferred = new Set(ov?.preferred ?? []);
  const util = utilityWeights(weapon);
  const base = dps(weapon, {});
  const full = dps(weapon, bonuses(stats, weapon, harmless));
  const burst = full.burst / base.burst - 1;
  const sustained = full.sustained / base.sustained - 1;

  let utility = 0;
  const perStat: Record<string, number> = {};
  for (const s of stats) {
    const sign: Sign = s.kind === 'curse' ? 'curse' : 'buff';
    const max = globalRange(s.id, sign, weapon, disposition).max || 1;
    const share = s.magnitude / max;
    let u = 0;
    if (!(sign === 'curse' && harmless.has(s.id))) {
      const w = util[s.id];
      if (w) u += share * (sign === 'curse' ? w.curse : w.buff);
      if (sign === 'buff' && preferred.has(s.id)) u += share * PREFERRED_BONUS * referenceGain(weapon, disposition);
    }
    utility += u;
    // Marginal DPS contribution of this stat alone, for the explanation.
    const alone = dps(weapon, bonuses([s], weapon, harmless));
    perStat[s.id] = BURST_WEIGHT * (alone.burst / base.burst - 1) + (1 - BURST_WEIGHT) * (alone.sustained / base.sustained - 1) + u;
  }
  return { total: BURST_WEIGHT * burst + (1 - BURST_WEIGHT) * sustained + utility, burst, sustained, utility, perStat };
}

export function rivenScoringStats(riven: Riven, weapon: Weapon): ScoringStat[] {
  const config = rivenConfig(riven);
  const disp = dispositionOf(weapon, riven);
  return riven.stats.map((s: RivenStat) => ({ id: s.id, kind: s.kind, magnitude: magnitude(s.id, s.kind, s.roll, config, weapon, disp) }));
}

// ----- Godroll and stat ranking -----

export interface Godroll {
  config: Config;
  buffs: string[];
  curse?: string;
  gain: number;
}

export interface StatRanking {
  buffs: { id: string; gain: number }[];
  /** Curses sorted from least to most harmful. */
  curses: { id: string; gain: number }[];
}

const cache = new Map<string, { godroll: Godroll; ranking: StatRanking }>();

function maxStat(id: string, kind: 'buff' | 'curse', config: Config, weapon: Weapon, disp: number): ScoringStat {
  return { id, kind, magnitude: magnitude(id, kind, 1.1, config, weapon, disp) };
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) return void out.push(acc.slice());
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

export function analyzeWeapon(weapon: Weapon, disposition = weapon.disposition): { godroll: Godroll; ranking: StatRanking } {
  const key = `${weapon.name}@${disposition}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ref: Config = { buffs: 3, curse: true };
  const buffPool = statPool(weapon, 'buff').map((s) => s.id);
  const cursePool = statPool(weapon, 'curse').map((s) => s.id);
  const buffs = buffPool
    .map((id) => ({ id, gain: gain([maxStat(id, 'buff', ref, weapon, disposition)], weapon, disposition).total }))
    .sort((a, b) => b.gain - a.gain);
  const curses = cursePool
    .map((id) => ({ id, gain: gain([maxStat(id, 'curse', ref, weapon, disposition)], weapon, disposition).total }))
    .sort((a, b) => b.gain - a.gain);

  // Interactions (crit × crit damage) make the best set non-additive: brute force over the top candidates.
  const top = buffs.slice(0, 10).map((b) => b.id);
  const curseCandidates = curses.slice(0, 6).map((c) => c.id);
  let best: Godroll = { config: ref, buffs: [], gain: -Infinity };
  for (const config of CONFIGS) {
    for (const set of combinations(top, config.buffs)) {
      const options = config.curse ? curseCandidates.filter((c) => !set.includes(c)) : [undefined];
      for (const curse of options) {
        const stats = set.map((id) => maxStat(id, 'buff', config, weapon, disposition));
        if (curse) stats.push(maxStat(curse, 'curse', config, weapon, disposition));
        const g = gain(stats, weapon, disposition).total;
        if (g > best.gain) best = { config, buffs: set, curse, gain: g };
      }
    }
  }
  const result = { godroll: best, ranking: { buffs, curses } };
  cache.set(key, result);
  return result;
}

// ----- Final evaluation -----

export type Label = 'Godroll' | 'Great' | 'Usable' | 'Roll for kuva' | 'Trash';
export type CurseVerdict = 'none' | 'harmless' | 'mild' | 'bad';

export interface Evaluation {
  score: number;
  label: Label;
  gain: GainBreakdown;
  godroll: Godroll;
  ranking: StatRanking;
  curse: CurseVerdict;
  summary: string;
}

export function curseVerdict(riven: Riven, weapon: Weapon, g: GainBreakdown): CurseVerdict {
  const c = riven.stats.find((s) => s.kind === 'curse');
  if (!c) return 'none';
  if (getOverride(weapon)?.harmlessCurses?.includes(c.id)) return 'harmless';
  const harm = g.perStat[c.id] ?? 0;
  if (harm > -0.02) return 'harmless';
  if (harm > -0.15) return 'mild';
  return 'bad';
}

export function evaluate(riven: Riven, weapon: Weapon): Evaluation {
  const disp = dispositionOf(weapon, riven);
  const { godroll, ranking } = analyzeWeapon(weapon, disp);
  const g = gain(rivenScoringStats(riven, weapon), weapon, disp);
  const score = Math.max(0, Math.min(100, (100 * g.total) / godroll.gain));
  const worthCycling = disp >= 0.9 || !!getOverride(weapon);
  const label: Label = score >= 85 ? 'Godroll' : score >= 65 ? 'Great' : score >= 45 ? 'Usable' : worthCycling ? 'Roll for kuva' : 'Trash';
  const curse = curseVerdict(riven, weapon, g);
  const names = riven.stats.filter((s) => s.kind !== 'curse').map((s) => getStat(s.id).label);
  const c = riven.stats.find((s) => s.kind === 'curse');
  const curseText = c ? `, ${curse} curse (${getStat(c.id).label})` : ', no curse';
  return {
    score,
    label,
    gain: g,
    godroll,
    ranking,
    curse,
    summary: `${label}: ${names.join(' / ')}${curseText}. ~${Math.round(g.burst * 100)}% burst DPS over the reference build.`,
  };
}
