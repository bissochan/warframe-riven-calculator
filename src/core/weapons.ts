import data from '../data/weapons.json';
import type { Weapon } from './types';

export const WEAPONS = data.weapons as Weapon[];
export const DATA_UPDATED: string = data.updated;
const BY_NAME = new Map(WEAPONS.map((w) => [w.name.toLowerCase(), w]));

export function findWeapon(name: string): Weapon | undefined {
  return BY_NAME.get(name.toLowerCase());
}

/** Subsequence fuzzy search: prefix matches first, then word-start matches, then loose subsequence. */
export function searchWeapons(query: string, limit = 12): Weapon[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: [number, Weapon][] = [];
  for (const w of WEAPONS) {
    const n = w.name.toLowerCase();
    let score = -1;
    if (n.startsWith(q)) score = 3;
    else if (n.split(/[\s-]/).some((part) => part.startsWith(q))) score = 2;
    else if (n.includes(q)) score = 1;
    else {
      let i = 0;
      for (const ch of n) if (ch === q[i]) i++;
      if (i === q.length) score = 0;
    }
    if (score >= 0) scored.push([score, w]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length).slice(0, limit).map(([, w]) => w);
}
