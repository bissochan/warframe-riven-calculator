import type { Evaluation as Eval } from '../core/evaluate';
import { formatValue, rivenName, statReport, type Grade, type StatReport } from '../core/riven';
import type { Riven, Weapon } from '../core/types';

export function GradeBadge({ g, title }: { g: Grade; title?: string }) {
  return (
    <span className={`grade grade-${g}`} title={title}>
      {g}
    </span>
  );
}

function RangeBar({ r }: { r: StatReport }) {
  const pct = Math.round(r.globalPosition * 100);
  const lo = formatValue(r.stat.id, r.stat.kind === 'curse' ? -r.global.min : r.global.min);
  const hi = formatValue(r.stat.id, r.stat.kind === 'curse' ? -r.global.max : r.global.max);
  const cfgLo = ((r.configRange.min - r.global.min) / (r.global.max - r.global.min)) * 100;
  const cfgHi = ((r.configRange.max - r.global.min) / (r.global.max - r.global.min)) * 100;
  return (
    <div className="rangebar" title={`Weapon-wide range ${lo} … ${hi}`}>
      <div className="track">
        <div className="cfg" style={{ left: `${cfgLo}%`, width: `${Math.max(1, cfgHi - cfgLo)}%` }} />
        <div className={`marker ${r.stat.kind}`} style={{ left: `${pct}%` }} />
      </div>
      <div className="ends small muted">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

const LABEL_CLASS: Record<string, string> = { Godroll: 'l-god', Great: 'l-great', Usable: 'l-ok', 'Roll for kuva': 'l-roll', Trash: 'l-trash' };
const CURSE_TEXT = { none: 'No curse', harmless: 'Harmless curse — sellable', mild: 'Mild curse', bad: 'Bad curse — avoid' };

export function Evaluation({ riven, weapon, evaluation }: { riven: Riven; weapon: Weapon; evaluation: Eval }) {
  const reports = riven.stats.map((s) => statReport(s, riven, weapon));
  const e = evaluation;
  return (
    <section className="card">
      <div className="score-head">
        <div className={`score ${LABEL_CLASS[e.label]}`}>
          <span className="num">{Math.round(e.score)}</span>
          <span className="of">/100</span>
        </div>
        <div>
          <div className={`label ${LABEL_CLASS[e.label]}`}>{e.label}</div>
          <div className="riven-name">{rivenName(riven, weapon)}</div>
          <div className="muted small">{CURSE_TEXT[e.curse]}</div>
        </div>
        <div className="gains">
          <div>
            <span className="muted small">Burst DPS</span>
            <strong>+{Math.round(e.gain.burst * 100)}%</strong>
          </div>
          <div>
            <span className="muted small">Sustained</span>
            <strong>+{Math.round(e.gain.sustained * 100)}%</strong>
          </div>
          <div>
            <span className="muted small">Utility</span>
            <strong>{e.gain.utility >= 0 ? '+' : ''}{Math.round(e.gain.utility * 100)}%</strong>
          </div>
        </div>
      </div>
      <p className="summary">{e.summary}</p>

      <table className="stats-table">
        <thead>
          <tr>
            <th>Stat</th>
            <th>Value</th>
            <th title="Position in the full range this weapon can roll (all configurations, current disposition)">Weapon grade</th>
            <th className="hide-sm">Range (all configs)</th>
            <th title="Roll inside this riven's own configuration (90–110%)">Roll</th>
            <th className="hide-sm" title="Score contribution of this stat alone">Impact</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.stat.id} className={r.stat.kind}>
              <td>
                <span className={`kind-dot ${r.stat.kind}`} />
                {r.def.label}
                {riven.locked === r.stat.id && ' 🔒'}
                {r.outOfRange && (
                  <span className="warn" title="Value outside the possible range: check rank, disposition or the number entered">
                    {' '}⚠
                  </span>
                )}
              </td>
              <td className="mono">{formatValue(r.stat.id, r.value)}</td>
              <td>
                <GradeBadge g={r.globalGrade} /> <span className="muted small">{Math.round((r.stat.kind === 'curse' ? 1 - r.globalPosition : r.globalPosition) * 100)}%</span>
              </td>
              <td className="hide-sm">
                <RangeBar r={r} />
              </td>
              <td>
                <GradeBadge g={r.rollGrade} /> <span className="muted small">{(r.stat.roll * 100).toFixed(1)}%</span>
              </td>
              <td className="hide-sm mono small">
                {(e.gain.perStat[r.stat.id] ?? 0) >= 0 ? '+' : ''}
                {Math.round((e.gain.perStat[r.stat.id] ?? 0) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Weapon grade: where the value sits between the weakest possible roll (3 buffs, no curse, 90%) and the strongest (2 buffs + curse, 110%) on this weapon. Roll: quality inside this riven's own configuration (90–110%). For curses, smaller is better.
      </p>
    </section>
  );
}
