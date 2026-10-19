// Expérience (XP) et jetons de récompense, gardés dans le navigateur. Rien n'a de valeur réelle.

const XP = 'holocote.xp.v1';
const TOKENS = 'holocote.tokens.v1';
export const MAX_REROLLS = 3;

interface XpStore { total: number }
interface Tokens { booster: number }

function read<T>(k: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...fallback, ...v } : fallback; } catch { return fallback; }
}
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* rien */ } };
const ping = () => window.dispatchEvent(new CustomEvent('holocote:progress'));

/** XP gagnée par les quêtes et coffres (les succès s'y ajoutent dans level.ts). */
export function storedXp(): number {
  const n = read<XpStore>(XP, { total: 0 }).total;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
export function addXp(n: number) {
  write(XP, { total: storedXp() + Math.max(0, Math.round(n)) });
  ping();
}

/** Relances du booster du jour disponibles. */
export function rerolls(): number {
  const n = read<Tokens>(TOKENS, { booster: 0 }).booster;
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_REROLLS, Math.floor(n))) : 0;
}
/** Ajoute une relance (au plus MAX_REROLLS en réserve). Renvoie false si la réserve est pleine. */
export function addReroll(): boolean {
  const n = rerolls();
  if (n >= MAX_REROLLS) return false;
  write(TOKENS, { booster: n + 1 });
  ping();
  return true;
}
export function useReroll(): boolean {
  const n = rerolls();
  if (n <= 0) return false;
  write(TOKENS, { booster: n - 1 });
  ping();
  return true;
}
