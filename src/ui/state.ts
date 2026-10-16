// Editor state <-> core Riven conversion, and localStorage persistence.
import { MAX_RANK } from '../core/mechanics';
import { displayToMagnitude, magnitude, rivenConfig, rollFromMagnitude } from '../core/riven';
import { getStat } from '../core/stats';
import type { Riven, StatKind, Weapon } from '../core/types';

export interface Row {
  id: string;
  kind: StatKind;
  /** Value exactly as shown in game, without sign (multiplier for faction stats). */
  shown: string;
}

export interface EditorState {
  weapon: string;
  rows: Row[];
  rank: number;
  rerolls: number;
  locked: string;
  disposition: string;
}

export const emptyState = (weapon = ''): EditorState => ({
  weapon,
  rows: [
    { id: '', kind: 'buff', shown: '' },
    { id: '', kind: 'buff', shown: '' },
  ],
  rank: MAX_RANK,
  rerolls: 0,
  locked: '',
  disposition: '',
});

export function toRiven(state: EditorState, weapon: Weapon): Riven | null {
  const rows = state.rows.filter((r) => r.id && r.shown !== '' && !Number.isNaN(Number(r.shown)));
  if (rows.filter((r) => r.kind !== 'curse').length < 2) return null;
  const disposition = state.disposition ? Number(state.disposition) : undefined;
  const config = rivenConfig({ stats: rows.map((r) => ({ id: r.id, kind: r.kind, roll: 1 })) });
  const stats = rows.map((r) => {
    const mag = displayToMagnitude(r.id, r.kind, Number(r.shown), state.rank);
    return { id: r.id, kind: r.kind, roll: rollFromMagnitude(r.id, r.kind, mag, config, weapon, disposition ?? weapon.disposition) };
  });
  return {
    weapon: weapon.name,
    stats,
    rerolls: state.rerolls,
    locked: state.locked && rows.some((r) => r.id === state.locked) ? state.locked : undefined,
    disposition,
  };
}

/** Value to show in the editor for a max-rank stat with a given roll. */
export function shownValue(id: string, kind: StatKind, mag: number): string {
  const def = getStat(id);
  if (def.unit === 'x') return (kind === 'curse' ? 1 - mag / 100 : 1 + mag / 100).toFixed(2);
  return mag.toFixed(1);
}

export function fromRiven(riven: Riven, weapon: Weapon, prev: EditorState): EditorState {
  const config = rivenConfig(riven);
  const disp = riven.disposition ?? weapon.disposition;
  return {
    ...prev,
    weapon: weapon.name,
    rank: MAX_RANK,
    rerolls: riven.rerolls,
    locked: riven.locked ?? '',
    rows: riven.stats.map((s) => ({ id: s.id, kind: s.kind, shown: shownValue(s.id, s.kind, magnitude(s.id, s.kind, s.roll, config, weapon, disp)) })),
  };
}

const KEY = 'riven-calc:v1';

export interface Saved {
  current: EditorState;
  history: { name: string; state: EditorState; score: number; savedAt: string }[];
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    /* storage unavailable */
  }
  return { current: emptyState(), history: [] };
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
