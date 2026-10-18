import { useEffect, useMemo, useState } from 'react';
import { evaluate } from './core/evaluate';
import { UNVERIFIED } from './core/mechanics';
import { rivenName } from './core/riven';
import type { Riven } from './core/types';
import { DATA_UPDATED, findWeapon } from './core/weapons';
import { Evaluation } from './ui/Evaluation';
import { RivenEditor } from './ui/RivenEditor';
import { Simulator } from './ui/Simulator';
import { emptyState, fromRiven, load, save, toRiven, type Saved } from './ui/state';
import { TargetPlanner } from './ui/TargetPlanner';
import { WeaponInsights } from './ui/WeaponInsights';
import { WeaponPicker } from './ui/WeaponPicker';
import { Heading } from './ui/Heading';
import { ThemeToggle } from './ui/ThemeToggle';

type Tab = 'evaluate' | 'simulate' | 'plan';

export default function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const [tab, setTab] = useState<Tab>('evaluate');
  const state = saved.current;
  const weapon = findWeapon(state.weapon);
  const riven = useMemo(() => (weapon ? toRiven(state, weapon) : null), [state, weapon]);
  const evaluation = useMemo(() => (riven && weapon ? evaluate(riven, weapon) : null), [riven, weapon]);
  const disposition = riven?.disposition ?? weapon?.disposition ?? 1;

  useEffect(() => save(saved), [saved]);

  const setState = (current: typeof state) => setSaved((s) => ({ ...s, current }));
  const updateState = (fn: (s: typeof state) => typeof state) => setSaved((s) => ({ ...s, current: fn(s.current) }));
  const applyRiven = (r: Riven) => weapon && setState(fromRiven(r, weapon, state));

  const saveToHistory = () => {
    if (!riven || !weapon || !evaluation) return;
    const entry = { name: rivenName(riven, weapon), state, score: evaluation.score, savedAt: new Date().toISOString() };
    setSaved((s) => ({ ...s, history: [entry, ...s.history.filter((h) => h.name !== entry.name)].slice(0, 30) }));
  };

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a href="./" className="brand-link" aria-label="Riven Calculator — home">
            <span className="brand">~/</span>riven-calculator
          </a>
          <nav aria-label="Main" className="header-nav">
            <a href="https://bissochan.github.io/projects/warframe-riven-calculator/" className="nav-link">
              About
            </a>
            <a href="https://github.com/bissochan/warframe-riven-calculator" className="nav-link">
              GitHub
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="container app">
      <section className="hero" aria-labelledby="hero-title">
        <p className="prompt">
          <span className="brand">~/riven-calculator</span> $ ./grade --riven
        </p>
        <h1 id="hero-title">Riven Calculator</h1>
        <p className="lead">Grade rivens against every roll their weapon can have, see the best stats per weapon, and simulate cycling, trait locking and splicing.</p>
      </section>

      <main id="main" className="layout">
        <div className="col-left">
          <section className="card">
            <Heading label="riven">Your riven</Heading>
            <WeaponPicker weapon={weapon} onPick={(w) => setState(state.weapon ? { ...state, weapon: w.name, rows: state.rows.map((r) => ({ ...r, id: '' })) } : emptyState(w.name))} />
            {weapon && <RivenEditor state={state} weapon={weapon} onChange={updateState} />}
            {weapon && (
              <div className="editor-actions">
                <button className="btn" onClick={saveToHistory} disabled={!evaluation}>
                  Save riven
                </button>
                <button className="btn ghost" onClick={() => setState(emptyState(weapon.name))}>
                  Clear
                </button>
              </div>
            )}
          </section>

          {saved.history.length > 0 && (
            <section className="card">
              <Heading label="saved">Saved rivens</Heading>
              <ul className="history">
                {saved.history.map((h) => (
                  <li key={h.name}>
                    <button className="link" onClick={() => setState(h.state)}>
                      {h.name}
                    </button>
                    <span className="mono small">{Math.round(h.score)}</span>
                    <button className="icon-btn" aria-label="Remove" onClick={() => setSaved((s) => ({ ...s, history: s.history.filter((x) => x !== h) }))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weapon && <WeaponInsights weapon={weapon} disposition={disposition} />}
        </div>

        <div className="col-right">
          {!weapon && (
            <section className="card empty">
              <Heading label="start">Start with a weapon</Heading>
              <p className="muted">Pick the riven's weapon, then enter its stats as shown in game. Grades, score and the best stats for the weapon appear here.</p>
            </section>
          )}
          {weapon && (
            <nav className="tabs" role="tablist">
              {(
                [
                  ['evaluate', 'Evaluation'],
                  ['simulate', 'Cycle & splice'],
                  ['plan', 'Kuva planner'],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
          )}
          {weapon && !riven && (
            <section className="card empty">
              <p className="muted">Enter at least two buffs with their values to grade the riven.</p>
            </section>
          )}
          {weapon && riven && evaluation && tab === 'evaluate' && <Evaluation riven={riven} weapon={weapon} evaluation={evaluation} />}
          {weapon && riven && tab === 'simulate' && <Simulator riven={riven} weapon={weapon} onApply={applyRiven} />}
          {weapon && riven && tab === 'plan' && <TargetPlanner riven={riven} weapon={weapon} />}
        </div>
      </main>

      </div>

      <footer className="site-footer">
        <div className="container foot">
        <details>
          <summary>Assumptions & sources</summary>
          <ul>
            {UNVERIFIED.map((u) => (
              <li key={u.name}>
                <strong>{u.name}</strong> (to verify): {String(typeof u.item.value === 'object' ? JSON.stringify(u.item.value) : u.item.value)} — {u.item.note ?? u.item.source}
              </li>
            ))}
            <li>Scores use a simplified damage model on a reference build per weapon class; utility stats use fixed weights; curated picks live in src/data/overrides.json.</li>
            <li>
              Mechanics: <a href="https://wiki.warframe.com/w/Riven_Mods">Warframe Wiki – Riven Mods</a>. Weapon data: <a href="https://github.com/WFCD/warframe-items">WFCD warframe-items</a> (snapshot {DATA_UPDATED}).
            </li>
          </ul>
        </details>
        <p className="mono-note">No cookies, no tracking. Fan-made tool, not affiliated with Digital Extremes. Warframe is a trademark of Digital Extremes Ltd.</p>
        <p>
          © {new Date().getFullYear()} <a href="https://bissochan.github.io/">Luca Bissoli</a>
        </p>
        </div>
      </footer>
    </>
  );
}
