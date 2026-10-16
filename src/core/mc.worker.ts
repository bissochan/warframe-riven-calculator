/// <reference lib="webworker" />
import { mulberry32 } from './cycle';
import { monteCarlo, type Target } from './probability';
import type { Riven, Weapon } from './types';

self.onmessage = (e: MessageEvent<{ riven: Riven; weapon: Weapon; target: Target; trials: number; seed: number }>) => {
  const { riven, weapon, target, trials, seed } = e.data;
  self.postMessage(monteCarlo(riven, weapon, target, mulberry32(seed), trials));
};
