// Riven attribute definitions: base values per weapon class, naming syllables,
// sign restrictions. Source: https://wiki.warframe.com/w/Riven_Mods (Oct 2026).
import type { StatClass } from './types';

export type StatUnit = '%' | 'x' | 's' | 'm' | 'flat';

export interface StatDef {
  id: string;
  label: string;
  /** Base value per weapon class, in display units (e.g. 149.99 for +149.99%). Missing = class cannot roll it. */
  base: Partial<Record<StatClass, number>>;
  unit: StatUnit;
  prefix: string;
  suffix: string;
  /** Can only appear as a bonus (never as a curse). */
  positiveOnly?: boolean;
  /** Can only appear as a curse. */
  negativeOnly?: boolean;
  /** Only obtainable through a Riven Splicer. */
  spliced?: boolean;
  /** In-game text shows the opposite sign (a buff to recoil reads "-X% Weapon Recoil"). */
  invertedDisplay?: boolean;
  /** Physical damage type, subject to the "weapon must have >25% of it" rule. */
  physical?: 'impact' | 'puncture' | 'slash';
  /** Only for projectile weapons. */
  projectileOnly?: boolean;
}

const ranged = (rifle: number, shotgun: number, pistol: number, archgun?: number) => {
  const b: Partial<Record<StatClass, number>> = { rifle, shotgun, pistol };
  if (archgun !== undefined) b.archgun = archgun;
  return b;
};
const all = (rifle: number, shotgun: number, pistol: number, archgun: number, melee: number) => ({ rifle, shotgun, pistol, archgun, melee });
const melee = (v: number) => ({ melee: v });
const rangedSame = (v: number, archgun = true) => (archgun ? ranged(v, v, v, v) : ranged(v, v, v));

export const STATS: StatDef[] = [
  // ----- Common -----
  { id: 'damage', label: 'Damage / Melee Damage', base: all(165, 164.7, 219.6, 99.9, 164.7), unit: '%', prefix: 'Visi', suffix: 'ata', positiveOnly: true },
  { id: 'cc', label: 'Critical Chance', base: all(149.99, 90, 149.99, 99.9, 180), unit: '%', prefix: 'Crita', suffix: 'cron' },
  { id: 'cd', label: 'Critical Damage', base: all(119.997, 90, 90, 80.1, 90), unit: '%', prefix: 'Acri', suffix: 'tis' },
  { id: 'fireRate', label: 'Fire Rate / Attack Speed', base: all(60.03, 90, 74.7, 60.03, 54.9), unit: '%', prefix: 'Croni', suffix: 'dra' },
  { id: 'sc', label: 'Status Chance', base: all(90, 90, 90, 60.3, 90), unit: '%', prefix: 'Hexa', suffix: 'dex' },
  { id: 'sd', label: 'Status Duration', base: all(99.99, 99.99, 99.99, 99.99, 99.99), unit: '%', prefix: 'Deci', suffix: 'des' },
  { id: 'heat', label: 'Heat', base: all(90, 90, 90, 119.7, 90), unit: '%', prefix: 'Igni', suffix: 'pha', positiveOnly: true },
  { id: 'cold', label: 'Cold', base: all(90, 90, 90, 119.7, 90), unit: '%', prefix: 'Geli', suffix: 'do', positiveOnly: true },
  { id: 'electricity', label: 'Electricity', base: all(90, 90, 90, 119.7, 90), unit: '%', prefix: 'Vexi', suffix: 'tio', positiveOnly: true },
  { id: 'toxin', label: 'Toxin', base: all(90, 90, 90, 119.7, 90), unit: '%', prefix: 'Toxi', suffix: 'tox', positiveOnly: true },
  { id: 'impact', label: 'Impact', base: all(119.97, 119.97, 119.97, 90, 119.7), unit: '%', prefix: 'Magna', suffix: 'ton', physical: 'impact' },
  { id: 'puncture', label: 'Puncture', base: all(119.997, 119.997, 119.997, 90, 119.997), unit: '%', prefix: 'Insi', suffix: 'cak', physical: 'puncture' },
  { id: 'slash', label: 'Slash', base: all(119.97, 119.97, 119.97, 90, 119.7), unit: '%', prefix: 'Sci', suffix: 'sus', physical: 'slash' },
  { id: 'corpus', label: 'Damage to Corpus', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Manti', suffix: 'tron' },
  { id: 'grineer', label: 'Damage to Grineer', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Argi', suffix: 'con' },
  { id: 'infested', label: 'Damage to Infested', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Pura', suffix: 'ada' },
  // ----- Ranged only -----
  { id: 'multishot', label: 'Multishot', base: ranged(90, 119.7, 119.7, 60.3), unit: '%', prefix: 'Sati', suffix: 'can' },
  { id: 'magazine', label: 'Magazine Capacity', base: ranged(49.995, 49.995, 49.995, 60.3), unit: '%', prefix: 'Arma', suffix: 'tin' },
  { id: 'reload', label: 'Reload Speed', base: ranged(49.995, 49.995, 49.995, 99.9), unit: '%', prefix: 'Feva', suffix: 'tak' },
  { id: 'ammo', label: 'Ammo Maximum', base: ranged(49.95, 90, 90, 99.9), unit: '%', prefix: 'Ampi', suffix: 'bin' },
  { id: 'punch', label: 'Punch Through', base: rangedSame(2.7), unit: 'm', prefix: 'Lexi', suffix: 'nok', positiveOnly: true },
  { id: 'projSpeed', label: 'Projectile Speed', base: ranged(90, 90, 90), unit: '%', prefix: 'Conci', suffix: 'nak', projectileOnly: true },
  { id: 'recoil', label: 'Weapon Recoil', base: rangedSame(90), unit: '%', prefix: 'Zeti', suffix: 'mag', invertedDisplay: true },
  { id: 'zoom', label: 'Zoom', base: ranged(59.99, 41.994, 80.1, 59.99), unit: '%', prefix: 'Hera', suffix: 'lis' },
  // ----- Melee only -----
  { id: 'range', label: 'Range', base: melee(1.94), unit: 'm', prefix: 'Locti', suffix: 'tor' },
  { id: 'comboDuration', label: 'Combo Duration', base: melee(8.1), unit: 's', prefix: 'Tempi', suffix: 'nem' },
  { id: 'initialCombo', label: 'Initial Combo', base: melee(24.5), unit: 'flat', prefix: 'Para', suffix: 'um', positiveOnly: true },
  { id: 'slideCC', label: 'Critical Chance (Slide Attack)', base: melee(120), unit: '%', prefix: 'Pleci', suffix: 'nent' },
  { id: 'finisher', label: 'Finisher Damage', base: melee(119.7), unit: '%', prefix: 'Exi', suffix: 'cta' },
  { id: 'heavyEfficiency', label: 'Heavy Attack Efficiency', base: melee(73.44), unit: '%', prefix: 'Forti', suffix: 'us' },
  { id: 'comboChance', label: 'Additional Combo Count Chance', base: melee(58.77), unit: '%', prefix: 'Laci', suffix: 'nus', positiveOnly: true },
  { id: 'comboGain', label: 'Chance to Gain Combo Count', base: melee(104.85), unit: '%', prefix: '', suffix: '', negativeOnly: true },
  // ----- Spliced (Update 44.1) -----
  { id: 'wpDamage', label: 'Weakpoint Damage', base: rangedSame(225), unit: '%', prefix: 'Eni', suffix: 'vo', spliced: true },
  { id: 'wpCC', label: 'Weakpoint Critical Chance', base: rangedSame(247.5), unit: '%', prefix: 'Exiti', suffix: 'eus', spliced: true },
  { id: 'ammoEfficiency', label: 'Ammo Efficiency', base: rangedSame(45), unit: '%', prefix: 'Parci', suffix: 'pia', spliced: true },
  { id: 'holsterReload', label: 'Reload While Holstered', base: ranged(90, 90, 90), unit: '%', prefix: 'Auxi', suffix: 'rro', spliced: true },
  { id: 'statusDamage', label: 'Status Damage', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Plaga', suffix: 'mna', spliced: true },
  { id: 'gas', label: 'Gas', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Cali', suffix: 'fel', spliced: true },
  { id: 'corrosive', label: 'Corrosive', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Cori', suffix: 'or', spliced: true },
  { id: 'viral', label: 'Viral', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Cari', suffix: 'sco', spliced: true },
  { id: 'radiation', label: 'Radiation', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Radi', suffix: 'lo', spliced: true },
  { id: 'blast', label: 'Blast', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Fraga', suffix: 'tus', spliced: true },
  { id: 'magnetic', label: 'Magnetic', base: all(90, 90, 90, 90, 90), unit: '%', prefix: 'Magni', suffix: 'bra', spliced: true },
  { id: 'orokin', label: 'Damage to Orokin', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Effi', suffix: 'tas', spliced: true },
  { id: 'techrot', label: 'Damage to Techrot', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Muti', suffix: 'gia', spliced: true },
  { id: 'scaldra', label: 'Damage to Scaldra', base: all(45, 45, 45, 45, 45), unit: 'x', prefix: 'Exsi', suffix: 'llo', spliced: true },
  { id: 'heavyDamage', label: 'Melee Damage on Heavy Attack', base: melee(119.7), unit: '%', prefix: 'Robi', suffix: 'ndo', spliced: true },
  { id: 'heavyWindup', label: 'Heavy Attack Wind Up Speed', base: melee(119.7), unit: '%', prefix: 'Veri', suffix: 'lus', spliced: true },
  { id: 'parry', label: 'Parry Angle', base: melee(81), unit: '%', prefix: 'Defi', suffix: 'so', spliced: true },
  { id: 'slam', label: 'Slam Attack Damage', base: melee(119.7), unit: '%', prefix: 'Proci', suffix: 'lam', spliced: true },
];

export const STAT_BY_ID: Record<string, StatDef> = Object.fromEntries(STATS.map((s) => [s.id, s]));

export function getStat(id: string): StatDef {
  const s = STAT_BY_ID[id];
  if (!s) throw new Error(`Unknown stat: ${id}`);
  return s;
}

export const FACTION_STATS = ['corpus', 'grineer', 'infested', 'orokin', 'techrot', 'scaldra'];
export const ELEMENT_STATS = ['heat', 'cold', 'electricity', 'toxin', 'gas', 'corrosive', 'viral', 'radiation', 'blast', 'magnetic'];
