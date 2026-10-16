// Cycling (kuva reroll), Trait Locking and Riven Splicer simulation.
import { CONFIG_PROBABILITY, CONFIGS, configKey, cycleCost, LOCK_KEEPS_VALUE, ROLL_MAX, ROLL_MIN } from './mechanics';
import { rivenConfig, statPool } from './riven';
import type { Config, Riven, RivenStat, Weapon } from './types';

export type Rng = () => number;

/** Small, fast seeded PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomRoll = (rng: Rng) => ROLL_MIN + rng() * (ROLL_MAX - ROLL_MIN);

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function randomConfig(rng: Rng): Config {
  let r = rng();
  for (const c of CONFIGS) {
    r -= CONFIG_PROBABILITY.value[configKey(c)];
    if (r < 0) return c;
  }
  return CONFIGS[CONFIGS.length - 1];
}

/** Stats kept through a cycle: the locked trait and the spliced trait. */
export function fixedStats(riven: Riven): RivenStat[] {
  return riven.stats.filter((s) => s.kind === 'spliced' || s.id === riven.locked);
}

/** One cycle: everything not locked/spliced is rerolled. Lock or splice freeze the buff/curse count. */
export function rollStats(riven: Riven, weapon: Weapon, rng: Rng): RivenStat[] {
  const fixed = fixedStats(riven).map((s) => (s.kind === 'spliced' || LOCK_KEEPS_VALUE.value ? s : { ...s, roll: randomRoll(rng) }));
  const config = fixed.length ? rivenConfig(riven) : randomConfig(rng);
  const taken = new Set(fixed.map((s) => s.id));
  const out = [...fixed];

  let buffSlots = config.buffs - fixed.filter((s) => s.kind !== 'curse').length;
  const buffs = statPool(weapon, 'buff').filter((s) => !taken.has(s.id));
  while (buffSlots-- > 0 && buffs.length) {
    const i = Math.floor(rng() * buffs.length);
    const [s] = buffs.splice(i, 1);
    taken.add(s.id);
    out.push({ id: s.id, kind: 'buff', roll: randomRoll(rng) });
  }
  if (config.curse && !fixed.some((s) => s.kind === 'curse')) {
    const curses = statPool(weapon, 'curse').filter((s) => !taken.has(s.id));
    if (curses.length) out.push({ id: pick(curses, rng).id, kind: 'curse', roll: randomRoll(rng) });
  }
  return out;
}

export interface CycleResult {
  riven: Riven;
  cost: number;
}

export function cycle(riven: Riven, weapon: Weapon, rng: Rng): CycleResult {
  const cost = cycleCost(riven.rerolls, !!riven.locked);
  return { riven: { ...riven, stats: rollStats(riven, weapon, rng), rerolls: riven.rerolls + 1 }, cost };
}

// ----- Riven Splicer (Update 44.1) -----

export interface Recipe {
  a: string;
  b: string;
  result: string;
  scope: 'ranged' | 'melee' | 'all';
}

export const RECIPES: Recipe[] = [
  { a: 'damage', b: 'zoom', result: 'wpDamage', scope: 'ranged' },
  { a: 'damage', b: 'multishot', result: 'wpDamage', scope: 'ranged' },
  { a: 'cc', b: 'zoom', result: 'wpCC', scope: 'ranged' },
  { a: 'cc', b: 'multishot', result: 'wpCC', scope: 'ranged' },
  { a: 'magazine', b: 'reload', result: 'ammoEfficiency', scope: 'ranged' },
  { a: 'recoil', b: 'ammo', result: 'ammoEfficiency', scope: 'ranged' },
  { a: 'ammo', b: 'reload', result: 'holsterReload', scope: 'ranged' },
  { a: 'ammo', b: 'magazine', result: 'holsterReload', scope: 'ranged' },
  { a: 'damage', b: 'sc', result: 'statusDamage', scope: 'ranged' },
  { a: 'heavyEfficiency', b: 'comboChance', result: 'heavyDamage', scope: 'melee' },
  { a: 'heavyEfficiency', b: 'comboDuration', result: 'heavyWindup', scope: 'melee' },
  { a: 'fireRate', b: 'range', result: 'parry', scope: 'melee' },
  { a: 'damage', b: 'fireRate', result: 'slam', scope: 'melee' },
  { a: 'damage', b: 'sc', result: 'statusDamage', scope: 'melee' },
  { a: 'toxin', b: 'heat', result: 'gas', scope: 'all' },
  { a: 'toxin', b: 'electricity', result: 'corrosive', scope: 'all' },
  { a: 'toxin', b: 'cold', result: 'viral', scope: 'all' },
  { a: 'heat', b: 'electricity', result: 'radiation', scope: 'all' },
  { a: 'heat', b: 'cold', result: 'blast', scope: 'all' },
  { a: 'electricity', b: 'cold', result: 'magnetic', scope: 'all' },
  { a: 'corpus', b: 'grineer', result: 'orokin', scope: 'all' },
  { a: 'corpus', b: 'infested', result: 'techrot', scope: 'all' },
  { a: 'infested', b: 'grineer', result: 'scaldra', scope: 'all' },
];

export function availableRecipes(riven: Riven, weapon: Weapon): Recipe[] {
  if (riven.stats.some((s) => s.kind === 'spliced')) return [];
  const melee = weapon.statClass === 'melee';
  const ids = new Set(riven.stats.map((s) => s.id));
  return RECIPES.filter((r) => (r.scope === 'all' || (r.scope === 'melee') === melee) && ids.has(r.a) && ids.has(r.b));
}

/**
 * Applies a splice: both traits are consumed, the spliced trait (always positive, locked for free)
 * inherits the higher roll, and a random trait of the consumed sign takes the other slot.
 */
export function splice(riven: Riven, weapon: Weapon, recipe: Recipe, rng: Rng): Riven {
  const a = riven.stats.find((s) => s.id === recipe.a)!;
  const b = riven.stats.find((s) => s.id === recipe.b)!;
  const curse = a.kind === 'curse' || b.kind === 'curse';
  const rest = riven.stats.filter((s) => s !== a && s !== b);
  const spliced: RivenStat = { id: recipe.result, kind: 'spliced', roll: Math.max(a.roll, b.roll) };
  const taken = new Set([...rest.map((s) => s.id), recipe.a, recipe.b]);
  const pool = statPool(weapon, curse ? 'curse' : 'buff').filter((s) => !taken.has(s.id));
  const replacement: RivenStat = { id: pick(pool, rng).id, kind: curse ? 'curse' : 'buff', roll: randomRoll(rng) };
  const locked = riven.locked === recipe.a || riven.locked === recipe.b ? undefined : riven.locked;
  return { ...riven, locked, stats: [...rest, spliced, replacement] };
}

/** Lifting the splice lock turns the spliced trait into a normal rerollable trait slot. */
export function unsplice(riven: Riven): Riven {
  return { ...riven, stats: riven.stats.map((s) => (s.kind === 'spliced' ? { ...s, kind: 'buff' as const } : s)) };
}
