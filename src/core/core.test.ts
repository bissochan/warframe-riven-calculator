import { describe, expect, it } from 'vitest';
import { availableRecipes, cycle, mulberry32, RECIPES, rollStats, splice } from './cycle';
import { analyzeWeapon, evaluate } from './evaluate';
import { cycleCost } from './mechanics';
import { estimateKuva, kuvaFor, matches, monteCarlo, successChance, type Target } from './probability';
import {
  configRange,
  displayToMagnitude,
  formatValue,
  globalRange,
  magnitude,
  rivenName,
  rollFromMagnitude,
  statPool,
  statReport,
} from './riven';
import type { Riven, Weapon } from './types';
import { findWeapon, searchWeapons } from './weapons';

const rifle: Weapon = {
  name: 'Test Rifle', type: 'rifle', statClass: 'rifle', subtype: 'Rifle', disposition: 1, dots: 3, hasStats: true,
  cc: 0.3, cd: 2.5, sc: 0.1, fireRate: 10, multishot: 1, magazine: 60, reload: 2, totalDamage: 100,
  impact: 10, puncture: 40, slash: 50, elements: {}, projectile: false, wikiUrl: null,
};
const weapon = (name: string) => {
  const w = findWeapon(name);
  if (!w) throw new Error(`missing ${name}`);
  return w;
};

describe('value math (wiki golden values)', () => {
  it('max CC on a 2+1 rifle riven at disposition 1', () => {
    expect(magnitude('cc', 'buff', 1.1, { buffs: 2, curse: true }, rifle)).toBeCloseTo(149.99 * 1.2375 * 1.1, 6);
  });
  it('global range spans 3+0 minimum to 2+1 maximum', () => {
    const r = globalRange('cc', 'buff', rifle, 1.3);
    expect(r.min).toBeCloseTo(149.99 * 1.3 * 0.75 * 0.9, 6);
    expect(r.max).toBeCloseTo(149.99 * 1.3 * 1.2375 * 1.1, 6);
  });
  it('curse range uses curse multipliers', () => {
    const r = globalRange('zoom', 'curse', rifle);
    expect(r.min).toBeCloseTo(59.99 * 0.495 * 0.9, 6);
    expect(r.max).toBeCloseTo(59.99 * 0.75 * 1.1, 6);
  });
  it('roll <-> magnitude round trip', () => {
    const c = { buffs: 3 as const, curse: true };
    const m = magnitude('multishot', 'buff', 1.037, c, rifle, 1.2);
    expect(rollFromMagnitude('multishot', 'buff', m, c, rifle, 1.2)).toBeCloseTo(1.037, 9);
  });
  it('config range is 90–110% of the unit value', () => {
    const r = configRange('cd', 'buff', { buffs: 2, curse: false }, rifle);
    expect(r.max / r.min).toBeCloseTo(1.1 / 0.9, 9);
  });
  it('rank scaling and faction multipliers on input', () => {
    expect(displayToMagnitude('cc', 'buff', 20, 0)).toBeCloseTo(180, 9);
    expect(displayToMagnitude('grineer', 'buff', 1.45)).toBeCloseTo(45, 9);
    expect(displayToMagnitude('grineer', 'curse', 0.7)).toBeCloseTo(30, 9);
  });
  it('formats like the game', () => {
    expect(formatValue('cc', 142.34)).toBe('+142.3%');
    expect(formatValue('recoil', 50)).toBe('-50.0%');
    expect(formatValue('corpus', -30)).toBe('x0.70');
  });
});

describe('stat pools', () => {
  it('rifle pool has the documented 24 stats when all physicals are eligible', () => {
    const w = { ...rifle, impact: 34, puncture: 33, slash: 33, projectile: true };
    expect(statPool(w, 'buff')).toHaveLength(24);
  });
  it('hitscan cannot roll projectile speed; low physical share cannot roll that physical', () => {
    const ids = statPool(rifle, 'buff').map((s) => s.id);
    expect(ids).not.toContain('projSpeed');
    expect(ids).not.toContain('impact');
    expect(ids).toContain('slash');
  });
  it('elementals and damage are never curses', () => {
    const ids = statPool(rifle, 'curse').map((s) => s.id);
    for (const id of ['heat', 'cold', 'toxin', 'electricity', 'damage', 'punch']) expect(ids).not.toContain(id);
  });
  it('melee has its own stats and no ranged ones', () => {
    const ids = statPool(weapon('Nikana Prime'), 'buff').map((s) => s.id);
    expect(ids).toContain('range');
    expect(ids).not.toContain('multishot');
    expect(statPool(weapon('Nikana Prime'), 'curse').map((s) => s.id)).toContain('comboGain');
  });
});

describe('grading', () => {
  it('max roll in the best config is S globally, min roll in 3+0 is F', () => {
    const top: Riven = { weapon: rifle.name, rerolls: 0, stats: [{ id: 'cc', kind: 'buff', roll: 1.1 }, { id: 'cd', kind: 'buff', roll: 1 }, { id: 'zoom', kind: 'curse', roll: 1 }] };
    expect(statReport(top.stats[0], top, rifle).globalGrade).toBe('S');
    const low: Riven = { weapon: rifle.name, rerolls: 0, stats: [{ id: 'cc', kind: 'buff', roll: 0.9 }, { id: 'cd', kind: 'buff', roll: 1 }, { id: 'sc', kind: 'buff', roll: 1 }] };
    const r = statReport(low.stats[0], low, rifle);
    expect(r.globalGrade).toBe('F');
    expect(r.rollGrade).toBe('F');
  });
  it('a small curse grades better than a large one', () => {
    const mk = (roll: number): Riven => ({ weapon: rifle.name, rerolls: 0, stats: [{ id: 'cc', kind: 'buff', roll: 1 }, { id: 'cd', kind: 'buff', roll: 1 }, { id: 'zoom', kind: 'curse', roll }] });
    expect(statReport(mk(0.9).stats[2], mk(0.9), rifle).globalGrade).toBe('S');
    expect(statReport(mk(1.1).stats[2], mk(1.1), rifle).rollGrade).toBe('F');
  });
});

describe('naming', () => {
  it('builds Prefix-coreSuffix from magnitudes', () => {
    const r: Riven = { weapon: rifle.name, rerolls: 0, stats: [{ id: 'multishot', kind: 'buff', roll: 1.1 }, { id: 'cc', kind: 'buff', roll: 1.1 }, { id: 'damage', kind: 'buff', roll: 0.9 }] };
    // magnitudes: cc 154.7 > damage 167*0.9=… check ordering explicitly
    const name = rivenName(r, rifle);
    expect(name.startsWith('Test Rifle ')).toBe(true);
    expect(name).toMatch(/^Test Rifle [A-Z][a-z]+-[a-z]+$/);
  });
});

describe('evaluation', () => {
  it('crit weapon godroll is built around CC/CD/MS/Damage', () => {
    const { godroll } = analyzeWeapon(weapon('Acceltra'));
    expect(godroll.buffs.length).toBeGreaterThanOrEqual(2);
    for (const id of godroll.buffs) expect(['cc', 'cd', 'multishot', 'damage', 'fireRate']).toContain(id);
  });
  it('godroll scores ~100, junk scores low', () => {
    const w = weapon('Acceltra');
    const { godroll } = analyzeWeapon(w);
    const best: Riven = {
      weapon: w.name, rerolls: 0,
      stats: [...godroll.buffs.map((id) => ({ id, kind: 'buff' as const, roll: 1.1 })), ...(godroll.curse ? [{ id: godroll.curse, kind: 'curse' as const, roll: 1.1 }] : [])],
    };
    expect(evaluate(best, w).score).toBeCloseTo(100, 0);
    const junk: Riven = { weapon: w.name, rerolls: 0, stats: [{ id: 'zoom', kind: 'buff', roll: 1 }, { id: 'recoil', kind: 'buff', roll: 1 }, { id: 'cc', kind: 'curse', roll: 1 }] };
    const e = evaluate(junk, w);
    expect(e.score).toBeLessThan(10);
    expect(e.curse).toBe('bad');
  });
  it('harmless curse is not penalized and lifts the buffs', () => {
    const w = weapon('Acceltra');
    const noCurse: Riven = { weapon: w.name, rerolls: 0, stats: [{ id: 'cc', kind: 'buff', roll: 1 }, { id: 'cd', kind: 'buff', roll: 1 }] };
    const withCurse: Riven = { ...noCurse, stats: [...noCurse.stats, { id: 'zoom', kind: 'curse', roll: 1 }] };
    const a = evaluate(noCurse, w);
    const b = evaluate(withCurse, w);
    expect(b.curse).toBe('harmless');
    expect(b.score).toBeGreaterThan(a.score);
  });
  it('melee values range', () => {
    const { ranking } = analyzeWeapon(weapon('Nikana Prime'));
    const top5 = ranking.buffs.slice(0, 5).map((b) => b.id);
    expect(top5).toContain('cc');
    expect(top5).toContain('range');
  });
});

describe('cycling, locking, splicing', () => {
  it('cycle cost table and lock doubling', () => {
    expect(cycleCost(0, false)).toBe(900);
    expect(cycleCost(9, false)).toBe(3500);
    expect(cycleCost(50, true)).toBe(7000);
    expect(kuvaFor(10, 0, false)).toBe(19950);
    expect(kuvaFor(10, 0, true)).toBe(39900);
  });
  it('random rolls respect configuration and uniqueness', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const stats = rollStats({ weapon: rifle.name, rerolls: 0, stats: [] }, rifle, rng);
      const buffs = stats.filter((s) => s.kind === 'buff').length;
      expect([2, 3]).toContain(buffs);
      expect(stats.filter((s) => s.kind === 'curse').length).toBeLessThanOrEqual(1);
      expect(new Set(stats.map((s) => s.id)).size).toBe(stats.length);
      for (const s of stats) expect(s.roll).toBeGreaterThanOrEqual(0.9);
    }
  });
  it('locked trait survives and freezes the configuration', () => {
    const rng = mulberry32(7);
    const r: Riven = { weapon: rifle.name, rerolls: 3, locked: 'cc', stats: [{ id: 'cc', kind: 'buff', roll: 1.05 }, { id: 'sc', kind: 'buff', roll: 1 }, { id: 'zoom', kind: 'curse', roll: 1 }] };
    for (let i = 0; i < 200; i++) {
      const { riven, cost } = cycle(r, rifle, rng);
      expect(cost).toBe(1400 * 2);
      expect(riven.stats.find((s) => s.id === 'cc')?.roll).toBe(1.05);
      expect(riven.stats.filter((s) => s.kind === 'buff')).toHaveLength(2);
      expect(riven.stats.filter((s) => s.kind === 'curse')).toHaveLength(1);
    }
  });
  it('splice: positive spliced trait with max roll, replacement keeps the curse sign', () => {
    const r: Riven = { weapon: rifle.name, rerolls: 0, stats: [{ id: 'damage', kind: 'buff', roll: 0.95 }, { id: 'cd', kind: 'buff', roll: 1 }, { id: 'zoom', kind: 'curse', roll: 1.08 }] };
    const recipes = availableRecipes(r, rifle);
    expect(recipes.map((x) => x.result)).toEqual(['wpDamage']);
    const out = splice(r, rifle, recipes[0], mulberry32(3));
    const sp = out.stats.find((s) => s.kind === 'spliced')!;
    expect(sp.id).toBe('wpDamage');
    expect(sp.roll).toBe(1.08);
    expect(out.stats.filter((s) => s.kind === 'curse')).toHaveLength(1);
    expect(out.stats).toHaveLength(3);
    expect(availableRecipes(out, rifle)).toHaveLength(0);
    // Spliced trait is kept by cycling and costs no extra kuva.
    const c = cycle(out, rifle, mulberry32(4));
    expect(c.cost).toBe(900);
    expect(c.riven.stats.find((s) => s.id === 'wpDamage')).toBeTruthy();
  });
  it('recipe table has 23 recipes for 18 results', () => {
    expect(RECIPES).toHaveLength(23);
    expect(new Set(RECIPES.map((r) => r.result)).size).toBe(18);
  });
});

describe('probability', () => {
  const target: Target = { required: ['cc', 'cd'], acceptable: ['multishot', 'damage'], curses: ['zoom', 'recoil'], allowNoCurse: true };
  it('exact chance matches Monte Carlo within tolerance', () => {
    const r: Riven = { weapon: rifle.name, rerolls: 0, stats: [] };
    const exact = successChance(r, rifle, target);
    expect(exact).toBeGreaterThan(0);
    const rng = mulberry32(42);
    let hits = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) if (matches({ ...r, stats: rollStats(r, rifle, rng) }, rifle, target)) hits++;
    expect(Math.abs(hits / n - exact)).toBeLessThan(exact * 0.15);
  });
  it('locking a required stat raises the chance', () => {
    const base: Riven = { weapon: rifle.name, rerolls: 0, stats: [{ id: 'cc', kind: 'buff', roll: 1 }, { id: 'sc', kind: 'buff', roll: 1 }, { id: 'zoom', kind: 'curse', roll: 1 }] };
    expect(successChance({ ...base, locked: 'cc' }, rifle, target)).toBeGreaterThan(successChance(base, rifle, target));
  });
  it('min values reduce the chance', () => {
    const r: Riven = { weapon: rifle.name, rerolls: 0, stats: [] };
    const strict = { ...target, minValues: { cc: magnitude('cc', 'buff', 1.05, { buffs: 2, curse: true }, rifle) } };
    expect(successChance(r, rifle, strict)).toBeLessThan(successChance(r, rifle, target));
  });
  it('kuva estimate for a certain hit is the next cycle cost', () => {
    const e = estimateKuva(1, 0, false);
    expect(e.expectedKuva).toBe(900);
    expect(e.p90.cycles).toBe(1);
  });
  it('monte carlo agrees with the analytic expected cycles', () => {
    const r: Riven = { weapon: rifle.name, rerolls: 0, stats: [] };
    const easy: Target = { required: ['cc'], acceptable: rifle ? statPool(rifle, 'buff').map((s) => s.id) : [], curses: statPool(rifle, 'curse').map((s) => s.id), allowNoCurse: true };
    const exact = successChance(r, rifle, easy);
    const mc = monteCarlo(r, rifle, easy, mulberry32(9), 3000);
    expect(Math.abs(mc.meanCycles - 1 / exact)).toBeLessThan(0.15 / exact);
  });
});

describe('weapon data', () => {
  it('search finds weapons by prefix and word', () => {
    expect(searchWeapons('torid')[0].name).toBe('Torid');
    expect(searchWeapons('bramma').map((w) => w.name)).toContain('Kuva Bramma');
  });
});
