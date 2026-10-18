import { enterableStats } from '../core/riven';
import { LockIcon, UnlockIcon } from './icons';
import { getStat } from '../core/stats';
import type { StatKind, Weapon } from '../core/types';
import type { EditorState, Row } from './state';

const KIND_LABEL: Record<StatKind, string> = { buff: 'Buff', curse: 'Curse', spliced: 'Spliced' };

function unitHint(id: string, kind: StatKind) {
  if (!id) return '';
  const def = getStat(id);
  if (def.unit === 'x') return kind === 'curse' ? 'x0.xx' : 'x1.xx';
  return { '%': '%', s: 's', m: 'm', flat: '' }[def.unit];
}

export function RivenEditor({ state, weapon, onChange }: { state: EditorState; weapon: Weapon; onChange: (update: (s: EditorState) => EditorState) => void }) {
  // Functional updates: several edits in the same event batch must not overwrite each other.
  const set = (patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) =>
    onChange((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  const setRow = (i: number, patch: Partial<Row>) => set((s) => ({ rows: s.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const buffs = state.rows.filter((r) => r.kind !== 'curse').length;
  const curses = state.rows.filter((r) => r.kind === 'curse').length;
  const spliced = state.rows.filter((r) => r.kind === 'spliced').length;
  const used = new Set(state.rows.map((r) => r.id));

  return (
    <div className="editor">
      <div className="rows">
        {state.rows.map((row, i) => {
          const options = enterableStats(weapon, row.kind);
          return (
            <div className={`row kind-${row.kind}`} key={i}>
              <select
                className="input kind"
                value={row.kind}
                onChange={(e) => setRow(i, { kind: e.target.value as StatKind, id: '' })}
                aria-label={`Stat ${i + 1} type`}
              >
                <option value="buff">Buff</option>
                <option value="curse" disabled={curses > 0 && row.kind !== 'curse'}>
                  Curse
                </option>
                <option value="spliced" disabled={spliced > 0 && row.kind !== 'spliced'}>
                  Spliced
                </option>
              </select>
              <select className="input stat" value={row.id} onChange={(e) => setRow(i, { id: e.target.value })} aria-label={`Stat ${i + 1}`}>
                <option value="">— {KIND_LABEL[row.kind]} stat —</option>
                {options.map((s) => (
                  <option key={s.id} value={s.id} disabled={used.has(s.id) && s.id !== row.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="value">
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="value"
                  value={row.shown}
                  onChange={(e) => setRow(i, { shown: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })}
                  aria-label={`Stat ${i + 1} value`}
                />
                <span className="unit">{unitHint(row.id, row.kind)}</span>
              </div>
              <button
                className={`icon-btn ${state.locked && state.locked === row.id ? 'on' : ''}`}
                title="Trait lock (doubles kuva cost)"
                disabled={!row.id || row.kind === 'spliced'}
                onClick={() => set((s) => ({ locked: s.locked === row.id ? '' : row.id }))}
                aria-label="Toggle trait lock"
              >
                {state.locked && state.locked === row.id ? <LockIcon /> : <UnlockIcon />}
              </button>
              <button className="icon-btn" title="Remove stat" onClick={() => set((s) => ({ rows: s.rows.filter((_, j) => j !== i) }))} disabled={state.rows.length <= 2} aria-label="Remove stat">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="editor-actions">
        <button className="btn ghost" disabled={buffs >= 3} onClick={() => set((s) => ({ rows: [...s.rows.filter((r) => r.kind !== 'curse'), { id: '', kind: 'buff', shown: '' }, ...s.rows.filter((r) => r.kind === 'curse')] }))}>
          + Buff
        </button>
        <button className="btn ghost" disabled={curses >= 1} onClick={() => set((s) => ({ rows: [...s.rows, { id: '', kind: 'curse', shown: '' }] }))}>
          + Curse
        </button>
        <label className="field">
          Mod rank
          <select className="input" value={state.rank} onChange={(e) => set({ rank: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Rerolls
          <input className="input narrow" type="number" min={0} value={state.rerolls} onChange={(e) => set({ rerolls: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="field">
          Disposition
          <input className="input narrow" inputMode="decimal" placeholder={weapon.disposition.toFixed(2)} value={state.disposition} onChange={(e) => set({ disposition: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} />
        </label>
      </div>
      <p className="hint">Enter values exactly as shown in game (no sign). Faction stats as multipliers, e.g. 1.32 or 0.71. Values below rank 8 are scaled to max rank.</p>
    </div>
  );
}
