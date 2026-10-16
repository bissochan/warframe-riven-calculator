// Exact odds of hitting a target riven by cycling, and the kuva it costs.
import { fixedStats, cycle, type Rng } from './cycle';
import { CONFIG_PROBABILITY, CONFIGS, configKey, cycleCost, CYCLE_COST, ROLL_MAX, ROLL_MIN } from './mechanics';
import { magnitude, rivenConfig, statPool } from './riven';
import type { Config, Riven, Weapon } from './types';

export interface Target {
  /** Buffs that must all be present. */
  required: string[];
  /** Extra buffs allowed in the remaining slots. Fixed (locked/spliced) traits are always allowed. */
  acceptable: string[];
  /** Allowed curses (empty = any curse is rejected). */
  curses: string[];
  allowNoCurse: boolean;
  /** Minimum magnitude (display units, max rank) per buff. */
  minValues?: Record<string, number>;
}

function combinations<T>(items: T[], k: number, visit: (combo: T[]) => void) {
  const acc: T[] = [];
  const rec = (start: number) => {
    if (acc.length === k) return visit(acc);
    for (let i = start; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i]);
      rec(i + 1);
      acc.pop();
    }
  };
  rec(0);
}

const binom = (n: number, k: number) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

/** P(uniform roll gives magnitude >= min). */
function rollOdds(id: string, min: number | undefined, config: Config, weapon: Weapon, disp: number): number {
  if (!min) return 1;
  const unit = magnitude(id, 'buff', 1, config, weapon, disp);
  const need = min / unit;
  if (need <= ROLL_MIN) return 1;
  if (need > ROLL_MAX) return 0;
  return (ROLL_MAX - need) / (ROLL_MAX - ROLL_MIN);
}

/** Probability that one cycle of `riven` matches `target`. */
export function successChance(riven: Riven, weapon: Weapon, target: Target): number {
  const disp = riven.disposition ?? weapon.disposition;
  const fixed = fixedStats(riven);
  const configs: [Config, number][] = fixed.length ? [[rivenConfig(riven), 1]] : CONFIGS.map((c) => [c, CONFIG_PROBABILITY.value[configKey(c)]]);
  const fixedBuffs = fixed.filter((s) => s.kind !== 'curse');
  const fixedCurse = fixed.find((s) => s.kind === 'curse');
  const allowedBuffs = new Set([...target.required, ...target.acceptable, ...fixedBuffs.map((s) => s.id)]);
  const allowedCurses = new Set(target.curses);
  const buffPool = statPool(weapon, 'buff').map((s) => s.id).filter((id) => !fixed.some((f) => f.id === id));
  const cursePool = statPool(weapon, 'curse').map((s) => s.id);

  let total = 0;
  for (const [config, p] of configs) {
    if (p === 0) continue;
    // Fixed traits must still satisfy the minimum values.
    let fixedOk = 1;
    for (const f of fixedBuffs) {
      const min = target.minValues?.[f.id];
      if (min && magnitude(f.id, f.kind, f.roll, config, weapon, disp) < min) fixedOk = 0;
    }
    if (!fixedOk) continue;
    const slots = config.buffs - fixedBuffs.length;
    if (slots < 0) continue;
    const perSubset = 1 / binom(buffPool.length, slots);
    let configTotal = 0;
    combinations(buffPool, slots, (subset) => {
      const all = [...fixedBuffs.map((s) => s.id), ...subset];
      if (!target.required.every((r) => all.includes(r))) return;
      if (!subset.every((s) => allowedBuffs.has(s))) return;
      let odds = 1;
      for (const s of subset) odds *= rollOdds(s, target.minValues?.[s], config, weapon, disp);
      if (odds === 0) return;
      let curseOdds: number;
      if (!config.curse) curseOdds = target.allowNoCurse ? 1 : 0;
      else if (fixedCurse) curseOdds = allowedCurses.has(fixedCurse.id) ? 1 : 0;
      else {
        const options = cursePool.filter((c) => !all.includes(c));
        curseOdds = options.length ? options.filter((c) => allowedCurses.has(c)).length / options.length : 0;
      }
      configTotal += odds * curseOdds;
    });
    total += p * perSubset * configTotal;
  }
  return total;
}

export function matches(riven: Riven, weapon: Weapon, target: Target): boolean {
  const config = rivenConfig(riven);
  const disp = riven.disposition ?? weapon.disposition;
  const buffs = riven.stats.filter((s) => s.kind !== 'curse');
  const curse = riven.stats.find((s) => s.kind === 'curse');
  const fixedIds = new Set(fixedStats(riven).map((s) => s.id));
  const allowed = new Set([...target.required, ...target.acceptable]);
  if (!target.required.every((r) => buffs.some((b) => b.id === r))) return false;
  if (!buffs.every((b) => allowed.has(b.id) || fixedIds.has(b.id))) return false;
  if (curse ? !target.curses.includes(curse.id) : !target.allowNoCurse) return false;
  return buffs.every((b) => {
    const min = target.minValues?.[b.id];
    return !min || magnitude(b.id, b.kind, b.roll, config, weapon, disp) >= min;
  });
}

// ----- Kuva expectations (geometric distribution with escalating cost) -----

export interface KuvaEstimate {
  chance: number;
  expectedCycles: number;
  expectedKuva: number;
  p50: { cycles: number; kuva: number };
  p90: { cycles: number; kuva: number };
}

/** Kuva spent for the next `cycles` cycles starting at reroll count `from`. */
export function kuvaFor(cycles: number, from: number, locked: boolean): number {
  const cap = CYCLE_COST.value.length - 1;
  let sum = 0;
  let k = 0;
  for (; k < cycles && from + k < cap; k++) sum += cycleCost(from + k, locked);
  return sum + (cycles - k) * cycleCost(cap, locked);
}

export function estimateKuva(chance: number, rerolls: number, locked: boolean): KuvaEstimate {
  if (chance <= 0) {
    const inf = { cycles: Infinity, kuva: Infinity };
    return { chance, expectedCycles: Infinity, expectedKuva: Infinity, p50: inf, p90: inf };
  }
  const cap = CYCLE_COST.value.length - 1;
  const miss = 1 - chance;
  let expected = 0;
  let survive = 1;
  let k = 0;
  for (; rerolls + k < cap; k++) {
    expected += cycleCost(rerolls + k, locked) * survive;
    survive *= miss;
  }
  expected += (cycleCost(cap, locked) * survive) / chance;
  const quantile = (q: number) => {
    const cycles = chance >= 1 ? 1 : Math.max(1, Math.ceil(Math.log(1 - q) / Math.log(miss)));
    return { cycles, kuva: kuvaFor(cycles, rerolls, locked) };
  };
  return { chance, expectedCycles: 1 / chance, expectedKuva: expected, p50: quantile(0.5), p90: quantile(0.9) };
}

// ----- Monte Carlo (runs in a Web Worker from the UI) -----

export interface MonteCarloResult {
  trials: number;
  successes: number;
  meanCycles: number;
  meanKuva: number;
  p50Cycles: number;
  p90Cycles: number;
  /** Observed per-cycle hit rate, to compare against the exact chance. */
  hitRate: number;
}

export function monteCarlo(riven: Riven, weapon: Weapon, target: Target, rng: Rng, trials = 2000, maxCycles = 5000): MonteCarloResult {
  const cycles: number[] = [];
  let kuvaTotal = 0;
  let hits = 0;
  let rolls = 0;
  for (let t = 0; t < trials; t++) {
    let current = riven;
    let spent = 0;
    for (let c = 1; c <= maxCycles; c++) {
      const res = cycle(current, weapon, rng);
      spent += res.cost;
      rolls++;
      // The player keeps the original riven between attempts; only the reroll count advances.
      current = { ...current, rerolls: res.riven.rerolls };
      if (matches(res.riven, weapon, target)) {
        hits++;
        cycles.push(c);
        kuvaTotal += spent;
        break;
      }
    }
  }
  cycles.sort((a, b) => a - b);
  const at = (q: number) => (cycles.length ? cycles[Math.min(cycles.length - 1, Math.floor(q * cycles.length))] : Infinity);
  return {
    trials,
    successes: cycles.length,
    meanCycles: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : Infinity,
    meanKuva: cycles.length ? kuvaTotal / cycles.length : Infinity,
    p50Cycles: at(0.5),
    p90Cycles: at(0.9),
    hitRate: rolls ? hits / rolls : 0,
  };
}
