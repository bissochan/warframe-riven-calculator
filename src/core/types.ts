export type StatClass = 'rifle' | 'shotgun' | 'pistol' | 'archgun' | 'melee';
export type RivenType = 'rifle' | 'shotgun' | 'pistol' | 'archgun' | 'melee' | 'kitgun' | 'zaw';

export interface Weapon {
  name: string;
  type: RivenType;
  statClass: StatClass;
  subtype: string;
  disposition: number;
  dots: number;
  /** False for modular parts (Zaw strikes, Kitgun chambers) whose stats depend on the build. */
  hasStats: boolean;
  cc: number;
  cd: number;
  sc: number;
  fireRate: number;
  multishot: number;
  magazine: number;
  reload: number;
  totalDamage: number;
  impact: number;
  puncture: number;
  slash: number;
  elements: Record<string, number>;
  projectile: boolean;
  wikiUrl: string | null;
}

export type StatKind = 'buff' | 'curse' | 'spliced';

export interface RivenStat {
  id: string;
  kind: StatKind;
  /** Random roll factor, nominally 0.9–1.1. Derived from the value for user-entered rivens. */
  roll: number;
}

export interface Riven {
  weapon: string;
  stats: RivenStat[];
  /** Number of times the riven has been cycled (drives the kuva cost). */
  rerolls: number;
  /** Stat id locked with Trait Locking (Update 44), if any. */
  locked?: string;
  /** Override for the weapon disposition (e.g. a riven checked against an older disposition). */
  disposition?: number;
}

export interface Config {
  buffs: 2 | 3;
  curse: boolean;
}
