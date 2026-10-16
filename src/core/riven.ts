// Riven value math: eligible pools, value <-> roll conversion, ranges, grades, names.
import { configKey, MAX_RANK, MULTIPLIERS, PHYSICAL_ROLL_THRESHOLD, ROLL_MAX, ROLL_MIN } from './mechanics';
import { getStat, STATS, type StatDef } from './stats';
import type { Config, Riven, RivenStat, StatKind, Weapon } from './types';

export type Sign = 'buff' | 'curse';

export function canRoll(stat: StatDef, weapon: Weapon, sign: Sign): boolean {
  if (stat.spliced) return false;
  if (stat.base[weapon.statClass] === undefined) return false;
  if (sign === 'buff' && stat.negativeOnly) return false;
  if (sign === 'curse' && stat.positiveOnly) return false;
  if (stat.projectileOnly && !weapon.projectile) return false;
  if (stat.id === 'magazine' && weapon.name === 'Grimoire') return false;
  if (stat.physical && weapon.hasStats && weapon.totalDamage > 0) {
    if (weapon[stat.physical] / weapon.totalDamage <= PHYSICAL_ROLL_THRESHOLD.value) return false;
  }
  return true;
}

/** Stats that can appear on a riven for this weapon through cycling. */
export function statPool(weapon: Weapon, sign: Sign): StatDef[] {
  return STATS.filter((s) => canRoll(s, weapon, sign));
}

/** Stats a user may enter (pool + spliced stats valid for the class). */
export function enterableStats(weapon: Weapon, kind: StatKind): StatDef[] {
  if (kind === 'spliced') return STATS.filter((s) => s.spliced && s.base[weapon.statClass] !== undefined);
  return statPool(weapon, kind);
}

export function rivenConfig(riven: Pick<Riven, 'stats'>): Config {
  const buffs = riven.stats.filter((s) => s.kind !== 'curse').length;
  return { buffs: buffs >= 3 ? 3 : 2, curse: riven.stats.some((s) => s.kind === 'curse') };
}

export function multiplier(config: Config, kind: StatKind): number {
  const m = MULTIPLIERS.value[configKey(config)];
  return kind === 'curse' ? m.curse : m.buff;
}

export function dispositionOf(weapon: Weapon, riven?: Pick<Riven, 'disposition'>): number {
  return riven?.disposition ?? weapon.disposition;
}

/** Magnitude (always positive) of a stat for a given roll, at max rank, in display units. */
export function magnitude(id: string, kind: StatKind, roll: number, config: Config, weapon: Weapon, disposition = weapon.disposition): number {
  const base = getStat(id).base[weapon.statClass] ?? 0;
  return base * disposition * multiplier(config, kind) * roll;
}

/** Signed value: positive for buffs, negative for curses. */
export function signedValue(stat: RivenStat, config: Config, weapon: Weapon, disposition = weapon.disposition): number {
  const m = magnitude(stat.id, stat.kind, stat.roll, config, weapon, disposition);
  return stat.kind === 'curse' ? -m : m;
}

export function rollFromMagnitude(id: string, kind: StatKind, value: number, config: Config, weapon: Weapon, disposition = weapon.disposition): number {
  const unit = magnitude(id, kind, 1, config, weapon, disposition);
  return unit > 0 ? value / unit : 0;
}

export interface Range {
  min: number;
  max: number;
}

/** Range of the magnitude across every configuration for this weapon (the "global" range). */
export function globalRange(id: string, kind: StatKind, weapon: Weapon, disposition = weapon.disposition): Range {
  const base = (getStat(id).base[weapon.statClass] ?? 0) * disposition;
  const mults = Object.values(MULTIPLIERS.value).map((m) => (kind === 'curse' ? m.curse : m.buff)).filter((m) => m > 0);
  return { min: base * Math.min(...mults) * ROLL_MIN, max: base * Math.max(...mults) * ROLL_MAX };
}

/** Range of the magnitude inside the riven's own configuration. */
export function configRange(id: string, kind: StatKind, config: Config, weapon: Weapon, disposition = weapon.disposition): Range {
  const unit = magnitude(id, kind, 1, config, weapon, disposition);
  return { min: unit * ROLL_MIN, max: unit * ROLL_MAX };
}

export const position = (v: number, r: Range) => (r.max > r.min ? (v - r.min) / (r.max - r.min) : 0);

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export const GRADE_THRESHOLDS: [Grade, number][] = [
  ['S', 0.9],
  ['A', 0.75],
  ['B', 0.55],
  ['C', 0.35],
  ['D', 0.15],
];

export function grade(fraction: number): Grade {
  for (const [g, t] of GRADE_THRESHOLDS) if (fraction >= t) return g;
  return 'F';
}

export interface StatReport {
  stat: RivenStat;
  def: StatDef;
  value: number;
  global: Range;
  globalPosition: number;
  /** For curses a smaller magnitude is better, so the grade uses the inverted position. */
  globalGrade: Grade;
  configRange: Range;
  rollPosition: number;
  rollGrade: Grade;
  outOfRange: boolean;
}

export function statReport(stat: RivenStat, riven: Riven, weapon: Weapon): StatReport {
  const config = rivenConfig(riven);
  const disp = dispositionOf(weapon, riven);
  const def = getStat(stat.id);
  const mag = magnitude(stat.id, stat.kind, stat.roll, config, weapon, disp);
  const g = globalRange(stat.id, stat.kind, weapon, disp);
  const c = configRange(stat.id, stat.kind, config, weapon, disp);
  const gp = clamp01(position(mag, g));
  const rp = clamp01((stat.roll - ROLL_MIN) / (ROLL_MAX - ROLL_MIN));
  const better = (p: number) => (stat.kind === 'curse' ? 1 - p : p);
  return {
    stat,
    def,
    value: stat.kind === 'curse' ? -mag : mag,
    global: g,
    globalPosition: gp,
    globalGrade: grade(better(gp)),
    configRange: c,
    rollPosition: rp,
    rollGrade: grade(better(rp)),
    outOfRange: stat.roll < ROLL_MIN - 0.005 || stat.roll > ROLL_MAX + 0.005,
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ----- Input / display conversion -----

/**
 * Converts the number shown in game (without sign) into a max-rank magnitude.
 * Faction stats are shown as multipliers (x1.32 buff, x0.71 curse).
 */
export function displayToMagnitude(id: string, kind: StatKind, shown: number, rank = MAX_RANK): number {
  const def = getStat(id);
  let mag = Math.abs(shown);
  if (def.unit === 'x') mag = kind === 'curse' ? (1 - shown) * 100 : (shown - 1) * 100;
  return (Math.abs(mag) * (MAX_RANK + 1)) / (rank + 1);
}

export function formatValue(id: string, signed: number, digits = 1): string {
  const def = getStat(id);
  if (def.unit === 'x') return `x${(1 + signed / 100).toFixed(2)}`;
  const shown = def.invertedDisplay ? -signed : signed;
  const sign = shown >= 0 ? '+' : '-';
  const n = Math.abs(shown).toFixed(digits);
  switch (def.unit) {
    case '%':
      return `${sign}${n}%`;
    case 's':
      return `${sign}${n}s`;
    case 'm':
      return `${sign}${n}m`;
    default:
      return `${sign}${n}`;
  }
}

/** Name generated by the game: Prefix-coreSuffix (3 buffs) or PrefixSuffix (2 buffs). Order by magnitude, highest first. */
export function rivenName(riven: Riven, weapon: Weapon): string {
  const config = rivenConfig(riven);
  const disp = dispositionOf(weapon, riven);
  const buffs = riven.stats
    .filter((s) => s.kind !== 'curse')
    .map((s) => ({ def: getStat(s.id), mag: magnitude(s.id, s.kind, s.roll, config, weapon, disp) }))
    .sort((a, b) => b.mag - a.mag);
  if (buffs.length < 2) return weapon.name;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const last = buffs[buffs.length - 1].def.suffix.toLowerCase();
  const name =
    buffs.length >= 3
      ? `${cap(buffs[0].def.prefix)}-${buffs[1].def.prefix.toLowerCase()}${last}`
      : `${cap(buffs[0].def.prefix)}${last}`;
  return `${weapon.name} ${name}`;
}
