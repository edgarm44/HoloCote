// Niveaux du dresseur : XP des quêtes + 25 XP par succès débloqué.

import { storedXp } from './xp';
import { computeBadges } from './badges';

export const XP_PER_BADGE = 25;
export const MAX_LEVEL = 50;

/** XP totale nécessaire pour atteindre un niveau (niveau 1 = 0). */
export function xpForLevel(level: number): number {
  // Paliers : 100, puis +50 par niveau (100, 150, 200…).
  const n = Math.max(1, Math.min(MAX_LEVEL, level)) - 1;
  return 100 * n + 25 * n * (n - 1);
}

const TITLES: [number, string][] = [
  [1, 'Dresseur débutant'], [3, 'Dresseur'], [5, 'Collectionneur'], [8, 'Expert des cotes'],
  [12, 'Maître du classeur'], [16, 'Champion'], [20, 'Légende holo'],
];
export const titleFor = (level: number) => [...TITLES].reverse().find(([l]) => level >= l)![1];

export interface LevelInfo { xp: number; level: number; title: string; floor: number; next: number; into: number; need: number; pct: number; max: boolean }

export function totalXp(): number {
  return storedXp() + computeBadges().filter((b) => b.got).length * XP_PER_BADGE;
}

export function levelInfo(xp = totalXp()): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const max = level >= MAX_LEVEL;
  const next = max ? floor : xpForLevel(level + 1);
  const need = next - floor;
  const into = xp - floor;
  return { xp, level, title: titleFor(level), floor, next, into, need, pct: max ? 1 : into / need, max };
}
