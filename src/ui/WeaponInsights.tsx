import { analyzeWeapon, getOverride } from '../core/evaluate';
import { Heading } from './Heading';
import { REFERENCE_BUILDS } from '../core/dps';
import { formatValue, magnitude } from '../core/riven';
import { getStat } from '../core/stats';
import type { Weapon } from '../core/types';

export function WeaponInsights({ weapon, disposition }: { weapon: Weapon; disposition: number }) {
  const { godroll, ranking } = analyzeWeapon(weapon, disposition);
  const ov = getOverride(weapon);
  const top = ranking.buffs.slice(0, 8);
  const max = Math.max(...top.map((b) => b.gain), 0.0001);
  const curses = ranking.curses.slice(0, 6);

  return (
    <section className="card">
      <Heading label="best-stats">Best stats for {weapon.name}</Heading>
      <p className="muted small">
        Gain of each stat alone at max roll on a 3+1 riven, on top of the reference build ({REFERENCE_BUILDS[weapon.statClass].label}).
      </p>
      <div className="bars">
        {top.map((b) => (
          <div className="bar-row" key={b.id}>
            <span className="bar-label">
              {getStat(b.id).label}
              {ov?.preferred?.includes(b.id) && <span className="tag small" title="Community pick">meta</span>}
            </span>
            <div className="bar">
              <div style={{ width: `${(b.gain / max) * 100}%` }} />
            </div>
            <span className="mono small">+{Math.round(b.gain * 100)}%</span>
          </div>
        ))}
      </div>

      <h3>Least harmful curses</h3>
      <div className="chips">
        {curses.map((c) => (
          <span key={c.id} className={`chip ${c.gain > -0.02 ? 'good' : c.gain > -0.15 ? 'mid' : 'bad'}`}>
            {getStat(c.id).label} <span className="mono small">{Math.round(c.gain * 100)}%</span>
          </span>
        ))}
      </div>

      <h3>Theoretical godroll</h3>
      <p>
        {godroll.buffs.map((id) => (
          <span key={id} className="chip good">
            {getStat(id).label} {formatValue(id, magnitude(id, 'buff', 1.1, godroll.config, weapon, disposition))}
          </span>
        ))}
        {godroll.curse && <span className="chip bad">{getStat(godroll.curse).label}</span>}
      </p>
      {ov?.note && <p className="note">{ov.note}</p>}
      {ov?.preferred && (
        <p className="muted small">
          Community picks: {ov.preferred.map((id) => getStat(id).label).join(', ')}
          {ov.harmlessCurses?.length ? ` · Accepted curses: ${ov.harmlessCurses.map((id) => getStat(id).label).join(', ')}` : ''}
        </p>
      )}
    </section>
  );
}
