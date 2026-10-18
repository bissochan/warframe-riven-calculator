import { useMemo, useState } from 'react';
import { LockIcon } from './icons';
import { Heading } from './Heading';
import { availableRecipes, cycle, mulberry32, splice, unsplice } from '../core/cycle';
import { evaluate } from '../core/evaluate';
import { cycleCost } from '../core/mechanics';
import { formatValue, rivenConfig, signedValue } from '../core/riven';
import { getStat } from '../core/stats';
import type { Riven, Weapon } from '../core/types';

function StatList({ riven, weapon }: { riven: Riven; weapon: Weapon }) {
  const config = rivenConfig(riven);
  const disp = riven.disposition ?? weapon.disposition;
  return (
    <ul className="statlist">
      {riven.stats.map((s) => (
        <li key={s.id} className={s.kind}>
          <span className="mono">{formatValue(s.id, signedValue(s, config, weapon, disp))}</span> {getStat(s.id).label}
          {s.kind === 'spliced' && <span className="tag small">spliced</span>}
          {riven.locked === s.id && <span className="muted"> <LockIcon /></span>}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  riven: Riven;
  weapon: Weapon;
  onApply: (r: Riven) => void;
}

export function Simulator({ riven, weapon, onApply }: Props) {
  const rng = useMemo(() => mulberry32(Date.now() & 0xffffffff), []);
  const [pending, setPending] = useState<Riven | null>(null);
  const [spent, setSpent] = useState(0);
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<{ score: number; label: string }[]>([]);

  const nextCost = cycleCost(riven.rerolls, !!riven.locked);
  const recipes = availableRecipes(riven, weapon);
  const hasSplice = riven.stats.some((s) => s.kind === 'spliced');

  const doCycle = () => {
    // In game you cycle the riven you kept; the reroll count always advances.
    const res = cycle(riven, weapon, rng);
    setPending(res.riven);
    setSpent((k) => k + res.cost);
    setCount((c) => c + 1);
    const ev = evaluate(res.riven, weapon);
    setLog((l) => [{ score: ev.score, label: ev.label }, ...l].slice(0, 30));
    onApply({ ...riven, rerolls: res.riven.rerolls });
  };

  const current = evaluate(riven, weapon);
  const next = pending ? evaluate(pending, weapon) : null;

  return (
    <section className="card">
      <Heading label="simulate">Cycle simulator</Heading>
      <p className="muted small">
        Next cycle: <strong>{nextCost.toLocaleString('en-US')} kuva</strong>
        {riven.locked && ` (×2 for the ${getStat(riven.locked).label} lock)`}
        {hasSplice && ' · spliced trait kept for free'} · Session: {count} cycles, {spent.toLocaleString('en-US')} kuva
      </p>
      <div className="sim-grid">
        <div className="sim-col">
          <div className="sim-head">
            Kept <span className="mono">{Math.round(current.score)}</span>
          </div>
          <StatList riven={riven} weapon={weapon} />
        </div>
        <div className="sim-col">
          <div className="sim-head">
            New roll {next && <span className="mono">{Math.round(next.score)}</span>}
          </div>
          {pending ? <StatList riven={pending} weapon={weapon} /> : <p className="muted small">Cycle to see a new roll.</p>}
        </div>
      </div>
      <div className="editor-actions">
        <button className="btn primary" onClick={doCycle}>
          Cycle ({nextCost.toLocaleString('en-US')} kuva)
        </button>
        <button
          className="btn"
          disabled={!pending}
          onClick={() => {
            if (pending) onApply(pending);
            setPending(null);
          }}
        >
          Keep new roll
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setSpent(0);
            setCount(0);
            setLog([]);
            setPending(null);
          }}
        >
          Reset session
        </button>
      </div>
      {log.length > 0 && (
        <div className="log">
          {log.map((l, i) => (
            <span key={log.length - i} className={`pill ${l.score >= 85 ? 'good' : l.score >= 45 ? 'mid' : 'bad'}`} title={l.label}>
              {Math.round(l.score)}
            </span>
          ))}
        </div>
      )}

      <h3>Riven Splicer</h3>
      {hasSplice ? (
        <p className="small">
          This riven already has a spliced trait (only one allowed). It is locked for free and survives cycles.{' '}
          <button className="btn ghost small" onClick={() => onApply(unsplice(riven))}>
            Lift splice lock
          </button>
        </p>
      ) : recipes.length ? (
        <div className="chips">
          {recipes.map((r) => (
            <button key={r.a + r.b} className="chip btn-chip" onClick={() => onApply(splice(riven, weapon, r, rng))} title="Consumes both traits; a random trait of the same sign fills the second slot">
              {getStat(r.a).label} + {getStat(r.b).label} → <strong>{getStat(r.result).label}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">No valid pair on this riven. Recipes need two specific traits (e.g. Toxin + Cold → Viral, Damage + Multishot → Weakpoint Damage).</p>
      )}
    </section>
  );
}
