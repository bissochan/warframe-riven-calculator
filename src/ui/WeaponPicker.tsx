import { useState } from 'react';
import { searchWeapons } from '../core/weapons';
import type { Weapon } from '../core/types';

const TYPE_LABEL: Record<string, string> = {
  rifle: 'Rifle', shotgun: 'Shotgun', pistol: 'Pistol', archgun: 'Arch-gun', melee: 'Melee', kitgun: 'Kitgun', zaw: 'Zaw',
};

export function Dots({ n }: { n: number }) {
  return (
    <span className="dots" aria-label={`${n} of 5 disposition`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? 'dot on' : 'dot'} />
      ))}
    </span>
  );
}

export function WeaponPicker({ weapon, onPick }: { weapon?: Weapon; onPick: (w: Weapon) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = searchWeapons(query);

  const choose = (w: Weapon) => {
    onPick(w);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="picker">
      <input
        className="input"
        placeholder={weapon ? `${weapon.name} — type to change weapon` : 'Search weapon (e.g. Torid, Acceltra, Nikana Prime)'}
        value={query}
        autoFocus={!weapon}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && results[active]) choose(results[active]);
          else if (e.key === 'Escape') setQuery('');
        }}
        aria-label="Weapon"
      />
      {query && results.length > 0 && (
        <ul className="dropdown" role="listbox">
          {results.map((w, i) => (
            <li
              key={w.name}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(w);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{w.name}</span>
              <span className="muted small">
                {TYPE_LABEL[w.type]} · {w.disposition.toFixed(2)} <Dots n={w.dots} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {weapon && (
        <div className="weapon-meta">
          <strong>{weapon.name}</strong>
          <span className="tag">{TYPE_LABEL[weapon.type]}</span>
          <span className="muted">{weapon.subtype}</span>
          <span>
            Disposition {weapon.disposition.toFixed(2)} <Dots n={weapon.dots} />
          </span>
          {weapon.hasStats ? (
            <span className="muted small">
              CC {(weapon.cc * 100).toFixed(0)}% · CD {weapon.cd.toFixed(1)}x · SC {(weapon.sc * 100).toFixed(0)}% · {weapon.fireRate.toFixed(2)}/s
            </span>
          ) : (
            <span className="muted small">Modular part: stats depend on the build, generic profile used for scoring.</span>
          )}
        </div>
      )}
    </div>
  );
}
