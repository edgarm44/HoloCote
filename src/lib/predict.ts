// Prédiction du jour : une carte, trois choix (la cote monte, reste stable ou baisse d'ici au prochain relevé).
// Jeu gratuit, sans mise : on ne perd jamais rien, on gagne seulement quelques Éclats (monnaie du site, sans valeur réelle).
// Le résultat est donné quand le relevé quotidien suivant est publié. Tout reste dans le navigateur.

import { todayNumber } from './mystery';
import { dayOf, seriesFor } from './history';
import { addCoins } from './wallet';
import type { Quote } from './market';
import type { Lang } from './tcgdex';

export type Dir = 'up' | 'flat' | 'down';
export interface PredResult { p1: number; chg: number; real: Dir; ok: boolean; coins: number }
export interface Pred { day: number; id: string; lang: Lang; name: string; image?: string; setName?: string; p0: number; hday: number; dir: Dir; res?: PredResult }

const KEY = 'holocote.predict.v1';
/** En dessous de ce seuil (en %), la cote est considérée comme stable. */
export const FLAT = 1;
export const COINS_OK = 30;
export const COINS_KO = 5;
export const DIR_LABEL: Record<Dir, string> = { up: 'Elle monte', flat: 'Elle reste stable', down: 'Elle baisse' };

function read(): Pred[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(v)) return v.filter((p) => p && typeof p.id === 'string' && typeof p.p0 === 'number' && typeof p.day === 'number');
  } catch { /* rien */ }
  return [];
}
const write = (l: Pred[]) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(-60))); } catch { /* rien */ } };

export const predictions = () => read();
export const todayPred = () => read().find((p) => p.day === todayNumber());
export const pendingPreds = () => read().filter((p) => !p.res);

export function stats() {
  const done = read().filter((p) => p.res).sort((a, b) => a.day - b.day);
  let streak = 0, best = 0, cur = 0;
  for (const p of done) { cur = p.res!.ok ? cur + 1 : 0; best = Math.max(best, cur); }
  streak = cur;
  return { played: done.length, won: done.filter((p) => p.res!.ok).length, streak, best };
}

export const classify = (chg: number): Dir => (chg > FLAT ? 'up' : chg < -FLAT ? 'down' : 'flat');

/** Carte du jour, la même pour tous : tirage fixe parmi les cotes fiables. */
export function dailyCard(pool: Quote[]): Quote | null {
  const list = pool.filter((q) => q.price >= 5 && !q.unsure && q.group === 'legend').sort((a, b) => a.id.localeCompare(b.id));
  const l = list.length >= 5 ? list : pool.filter((q) => q.price >= 3 && !q.unsure).sort((a, b) => a.id.localeCompare(b.id));
  if (!l.length) return null;
  let x = (todayNumber() * 48271 + 11) % 2147483647;
  x = (x * 16807) % 2147483647;
  return l[x % l.length];
}

/** Dernier relevé à la date donnée (ou avant), pour fixer le point de départ. */
async function baseline(q: { id: string; lang: Lang }, hday: number, fallback: number) {
  try {
    const s = await seriesFor(q.id, q.lang);
    const before = s.points.filter((p) => p.day <= hday);
    return before.length ? before[before.length - 1].price : fallback;
  } catch { return fallback; }
}

export async function makePrediction(q: Quote, dir: Dir): Promise<Pred | null> {
  if (todayPred()) return null;
  const hday = dayOf();
  const p0 = await baseline(q, hday, q.price);
  const p: Pred = { day: todayNumber(), id: q.id, lang: q.lang, name: q.name, image: q.image, setName: q.setName, p0, hday, dir };
  write([...read(), p]);
  window.dispatchEvent(new CustomEvent('defi:changed'));
  return p;
}

/** Résout les prédictions dont le relevé suivant est arrivé. Renvoie celles qui viennent d'être résolues (Éclats déjà crédités). */
export async function resolvePending(): Promise<Pred[]> {
  const list = read();
  const out: Pred[] = [];
  for (const p of list) {
    if (p.res) continue;
    let s;
    try { s = await seriesFor(p.id, p.lang); } catch { continue; }
    const next = s.points.find((x) => x.day > p.hday);
    if (!next) continue;
    const chg = ((next.price - p.p0) / p.p0) * 100;
    const real = classify(chg);
    const ok = real === p.dir;
    const coins = ok ? COINS_OK : COINS_KO;
    p.res = { p1: next.price, chg, real, ok, coins };
    out.push(p);
  }
  if (out.length) {
    write(list);
    for (const p of out) addCoins(p.res!.coins, `Prédiction : ${p.name}`);
    window.dispatchEvent(new CustomEvent('defi:changed'));
  }
  return out;
}
