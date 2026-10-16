// Single place for every riven game constant. Each value names its source and
// whether it is verified, so a correction lands here and nowhere else.
import type { Config } from './types';

export interface Sourced<T> {
  value: T;
  source: string;
  verified: boolean;
  note?: string;
}

const WIKI = 'https://wiki.warframe.com/w/Riven_Mods';

/** Bonus/curse multipliers by configuration. */
export const MULTIPLIERS: Sourced<Record<string, { buff: number; curse: number }>> = {
  value: {
    '2-0': { buff: 0.99, curse: 0 },
    '2-1': { buff: 1.2375, curse: 0.495 },
    '3-0': { buff: 0.75, curse: 0 },
    '3-1': { buff: 0.9375, curse: 0.75 },
  },
  source: WIKI,
  verified: true,
};

/** Each value is base × disposition × multiplier × roll, roll uniform in [ROLL_MIN, ROLL_MAX]. */
export const ROLL_MIN = 0.9;
export const ROLL_MAX = 1.1;
export const ROLL_DISTRIBUTION: Sourced<'uniform'> = {
  value: 'uniform',
  source: WIKI,
  verified: false,
  note: 'The 90–110% range is documented; the distribution inside it is assumed uniform.',
};

/** Probability of each configuration when unveiling or cycling. */
export const CONFIG_PROBABILITY: Sourced<Record<string, number>> = {
  value: { '2-0': 0.25, '2-1': 0.25, '3-0': 0.25, '3-1': 0.25 },
  source: 'Community consensus (2 or 3 buffs 50/50, curse 50/50)',
  verified: false,
  note: 'Not documented by DE or the wiki.',
};

/** Stats are drawn uniformly without replacement from the eligible pool. */
export const STAT_SELECTION: Sourced<'uniform'> = {
  value: 'uniform',
  source: 'Community consensus',
  verified: false,
};

/** Kuva cost of the n-th cycle (index 0 = first cycle), capped at the last value. */
export const CYCLE_COST: Sourced<number[]> = {
  value: [900, 1000, 1200, 1400, 1700, 2000, 2350, 2750, 3150, 3500],
  source: WIKI,
  verified: true,
};

/** Trait Locking (Update 44): one trait at a time, doubles the cycle cost, keeps the buff/curse count. */
export const LOCK_COST_MULTIPLIER: Sourced<number> = { value: 2, source: WIKI, verified: true };
export const LOCK_KEEPS_VALUE: Sourced<boolean> = {
  value: true,
  source: 'Assumption',
  verified: false,
  note: 'Whether the locked trait keeps its exact value or rerolls its magnitude is not documented.',
};

/** Riven Splicer (Update 44.1): spliced stat is locked for free and inherits the higher roll of the two consumed traits. */
export const SPLICE_ROLL_RULE: Sourced<'max'> = { value: 'max', source: WIKI, verified: true };
export const SPLICE_LOCK_COSTS_EXTRA: Sourced<boolean> = { value: false, source: WIKI, verified: true };

/** Physical damage stats need the weapon to deal more than this share of that type. */
export const PHYSICAL_ROLL_THRESHOLD: Sourced<number> = {
  value: 0.25,
  source: WIKI,
  verified: false,
  note: 'The wiki says "usually"; exceptions exist case by case.',
};

/** Mod rank scaling: value at rank r = max × (r + 1) / (MAX_RANK + 1). */
export const MAX_RANK = 8;

export const CONFIGS: Config[] = [
  { buffs: 2, curse: false },
  { buffs: 2, curse: true },
  { buffs: 3, curse: false },
  { buffs: 3, curse: true },
];

export const configKey = (c: Config) => `${c.buffs}-${c.curse ? 1 : 0}`;

export function cycleCost(rerollsDone: number, locked: boolean): number {
  const table = CYCLE_COST.value;
  const base = table[Math.min(rerollsDone, table.length - 1)];
  return locked ? base * LOCK_COST_MULTIPLIER.value : base;
}

/** All constants that are still unverified, for the UI disclaimer. */
export const UNVERIFIED: { name: string; item: Sourced<unknown> }[] = [
  { name: 'Roll distribution', item: ROLL_DISTRIBUTION },
  { name: 'Configuration odds', item: CONFIG_PROBABILITY },
  { name: 'Stat selection', item: STAT_SELECTION },
  { name: 'Locked trait value', item: LOCK_KEEPS_VALUE },
  { name: 'Physical stat eligibility', item: PHYSICAL_ROLL_THRESHOLD },
];
