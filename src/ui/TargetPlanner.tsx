import { useEffect, useMemo, useState } from 'react';
import { Heading } from './Heading';
import { analyzeWeapon } from '../core/evaluate';
import { estimateKuva, successChance, type MonteCarloResult, type Target } from '../core/probability';
import { statPool } from '../core/riven';
import { getStat } from '../core/stats';
import type { Riven, Weapon } from '../core/types';

type Role = 'required' | 'acceptable' | 'off';

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '∞');
const pct = (p: number) => (p >= 0.01 ? `${(p * 100).toFixed(2)}%` : p > 0 ? `1 in ${fmt(1 / p)}` : '0%');

function defaultTarget(weapon: Weapon, disposition: number): Target {
  const { godroll, ranking } = analyzeWeapon(weapon, disposition);
  const required = godroll.buffs.slice(0, 2);
  const acceptable = ranking.buffs.map((b) => b.id).filter((id) => !required.includes(id)).slice(0, 4);
  const curses = ranking.curses.filter((c) => c.gain > -0.02).map((c) => c.id);
  return { required, acceptable, curses, allowNoCurse: true, minValues: {} };
}

export function TargetPlanner({ riven, weapon }: { riven: Riven; weapon: Weapon }) {
  const disp = riven.disposition ?? weapon.disposition;
  const [target, setTarget] = useState<Target>(() => defaultTarget(weapon, disp));
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setTarget(defaultTarget(weapon, disp));
    setMc(null);
  }, [weapon, disp]);

  const buffs = statPool(weapon, 'buff');
  const curses = statPool(weapon, 'curse');
  const role = (id: string): Role => (target.required.includes(id) ? 'required' : target.acceptable.includes(id) ? 'acceptable' : 'off');
  const cycleRole = (id: string) => {
    const next: Role = { off: 'required', required: 'acceptable', acceptable: 'off' }[role(id)] as Role;
    const required = target.required.filter((x) => x !== id);
    const acceptable = target.acceptable.filter((x) => x !== id);
    if (next === 'required') required.push(id);
    if (next === 'acceptable') acceptable.push(id);
    setTarget({ ...target, required: required.slice(0, 3), acceptable });
  };

  // Strategies: no lock, or lock one of the required stats already on the riven.
  const strategies = useMemo(() => {
    const base: Riven = { ...riven, locked: undefined };
    const out = [{ name: 'No lock', riven: base }];
    for (const s of riven.stats) {
      if (s.kind === 'spliced') continue;
      const useful = s.kind === 'curse' ? target.curses.includes(s.id) : target.required.includes(s.id);
      if (useful) out.push({ name: `Lock ${getStat(s.id).label}`, riven: { ...riven, locked: s.id } });
    }
    return out.map((st) => {
      const chance = successChance(st.riven, weapon, target);
      return { ...st, chance, est: estimateKuva(chance, riven.rerolls, !!st.riven.locked) };
    });
  }, [riven, weapon, target]);
  const best = strategies.reduce((a, b) => (b.est.expectedKuva < a.est.expectedKuva ? b : a), strategies[0]);

  const runMc = () => {
    setRunning(true);
    setMc(null);
    const worker = new Worker(new URL('../core/mc.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MonteCarloResult>) => {
      setMc(e.data);
      setRunning(false);
      worker.terminate();
    };
    worker.postMessage({ riven: best.riven, weapon, target, trials: 2000, seed: Date.now() & 0xffffffff });
  };

  const hasSplice = riven.stats.some((s) => s.kind === 'spliced');

  return (
    <section className="card">
      <Heading label="plan">Kuva planner</Heading>
      <p className="muted small">Click a stat to cycle: required → acceptable → ignored. Required stats must all appear; the other slots may only hold acceptable stats.</p>
      <div className="chips">
        {buffs.map((s) => (
          <button key={s.id} className={`chip btn-chip role-${role(s.id)}`} onClick={() => cycleRole(s.id)}>
            {s.label}
            {role(s.id) === 'required' && ' ★'}
          </button>
        ))}
      </div>
      {target.required.length > 0 && (
        <div className="minvals">
          {target.required.map((id) => (
            <label key={id} className="field">
              Min {getStat(id).label}
              <input
                className="input narrow"
                inputMode="decimal"
                placeholder="any"
                value={target.minValues?.[id] ?? ''}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  const minValues = { ...target.minValues };
                  if (e.target.value && Number.isFinite(v)) minValues[id] = v;
                  else delete minValues[id];
                  setTarget({ ...target, minValues });
                }}
              />
            </label>
          ))}
        </div>
      )}
      <h3>Accepted curses</h3>
      <div className="chips">
        <button className={`chip btn-chip ${target.allowNoCurse ? 'role-acceptable' : 'role-off'}`} onClick={() => setTarget({ ...target, allowNoCurse: !target.allowNoCurse })}>
          No curse
        </button>
        {curses.map((s) => {
          const on = target.curses.includes(s.id);
          return (
            <button key={s.id} className={`chip btn-chip ${on ? 'role-curse' : 'role-off'}`} onClick={() => setTarget({ ...target, curses: on ? target.curses.filter((c) => c !== s.id) : [...target.curses, s.id] })}>
              {s.label}
            </button>
          );
        })}
      </div>

      <table className="stats-table plan">
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Chance / cycle</th>
            <th>Avg cycles</th>
            <th>Avg kuva</th>
            <th className="hide-sm">50% by</th>
            <th className="hide-sm">90% by</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr key={s.name} className={s === best ? 'best' : ''}>
              <td>
                {s.name}
                {s === best && <span className="tag small">best</span>}
              </td>
              <td className="mono">{pct(s.chance)}</td>
              <td className="mono">{fmt(s.est.expectedCycles)}</td>
              <td className="mono">{fmt(s.est.expectedKuva)}</td>
              <td className="mono hide-sm">{fmt(s.est.p50.kuva)}</td>
              <td className="mono hide-sm">{fmt(s.est.p90.kuva)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Exact odds from the riven rules (current reroll count {riven.rerolls}, cost capped at 3,500 / 7,000 locked){hasSplice && ', spliced trait kept'}. Locking keeps the current buff/curse count.
      </p>
      <div className="editor-actions">
        <button className="btn" onClick={runMc} disabled={running || best.chance < 1e-4}>
          {running ? 'Simulating…' : `Verify with Monte Carlo (${best.name})`}
        </button>
        {best.chance < 1e-4 && <span className="muted small">Target too rare to simulate.</span>}
      </div>
      {mc && (
        <p className="small">
          {mc.successes}/{mc.trials} runs succeeded · avg {mc.meanCycles.toFixed(1)} cycles, {fmt(mc.meanKuva)} kuva · median {mc.p50Cycles}, 90% by {mc.p90Cycles} cycles · observed hit rate {pct(mc.hitRate)}
        </p>
      )}
    </section>
  );
}
