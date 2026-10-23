// Trouve l'intrus : quatre cartes, trois ont un point commun (extension, rareté ou époque), une seule n'a rien à voir.
// Une partie par jour avec quelques Éclats à gagner (monnaie sans valeur réelle), et des parties d'entraînement sans gain.

import { todayNumber } from './mystery';
import { eraOf, ERAS, type Quote } from './market';
import { addCoins } from './wallet';

export interface Round { ids: string[]; odd: string; rule: string; oddWhy: string }
export interface Daily { day: number; round: Round; picked?: string; ok?: boolean }

const KEY = 'holocote.intrus.v1';
const STATS = 'holocote.intrus.stats.v1';
export const COINS_OK = 25;
export const COINS_KO = 5;

type Trait = { name: string; of: (q: Quote) => string | undefined; rule: (v: string) => string; why: (v: string) => string };
const eraName = (id: string) => ERAS.find((e) => e.key === eraOf(id))?.label ?? '';
const TRAITS: Trait[] = [
  { name: 'set', of: (q) => q.setName, rule: (v) => `Les trois autres cartes viennent de l’extension « ${v} ».`, why: (v) => `Elle vient de « ${v} »` },
  { name: 'rarity', of: (q) => q.rarity, rule: (v) => `Les trois autres cartes ont la rareté « ${v} ».`, why: (v) => `Sa rareté : « ${v} »` },
  { name: 'era', of: (q) => eraName(q.id) || undefined, rule: (v) => `Les trois autres cartes sont de l’époque « ${v} ».`, why: (v) => `Elle est de l’époque « ${v} »` },
];

/** Construit une manche à partir d'une graine (la même graine donne la même manche). */
export function buildRound(pool: Quote[], seed: number): Round | null {
  let x = (seed * 2654435761) % 2147483647 || 1;
  const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  const cards = pool.filter((q) => q.image && q.price >= 1);
  const order = [...TRAITS].sort(() => rnd() - 0.5);
  for (const t of order) {
    for (let k = 0; k < 12; k++) {
      const groups = new Map<string, Quote[]>();
      for (const q of cards) { const v = t.of(q); if (v) (groups.get(v) ?? groups.set(v, []).get(v)!).push(q); }
      const ok = [...groups.entries()].filter(([, l]) => new Set(l.map((q) => q.name)).size >= 3).sort((a, b) => a[0].localeCompare(b[0]));
      if (!ok.length) break;
      const [val, list] = ok[Math.floor(rnd() * ok.length)];
      const three: Quote[] = [];
      for (const q of [...list].sort(() => rnd() - 0.5)) if (!three.some((y) => y.name === q.name)) three.push(q);
      const trio = three.slice(0, 3);
      const others = cards.filter((q) => t.of(q) && t.of(q) !== val && !trio.some((y) => y.name === q.name));
      if (trio.length < 3 || !others.length) continue;
      const odd = others[Math.floor(rnd() * others.length)];
      const all = [...trio, odd].sort(() => rnd() - 0.5);
      return { ids: all.map((q) => q.id), odd: odd.id, rule: t.rule(val), oddWhy: t.why(t.of(odd)!) };
    }
  }
  return null;
}

export function daily(): Daily | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Daily | null;
    return v && v.day === todayNumber() && v.round && Array.isArray(v.round.ids) ? v : null;
  } catch { return null; }
}
export const saveDaily = (d: Daily) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* rien */ } };

export function stats() {
  try { const v = JSON.parse(localStorage.getItem(STATS) || 'null'); if (v) return { played: v.played | 0, won: v.won | 0, streak: v.streak | 0, best: v.best | 0 }; } catch { /* rien */ }
  return { played: 0, won: 0, streak: 0, best: 0 };
}

/** Enregistre la réponse du jour et crédite les Éclats (une seule fois). */
export function answer(d: Daily, pick: string): Daily {
  if (d.picked) return d;
  const ok = pick === d.round.odd;
  const next = { ...d, picked: pick, ok };
  saveDaily(next);
  const s = stats();
  s.played += 1; s.won += ok ? 1 : 0; s.streak = ok ? s.streak + 1 : 0; s.best = Math.max(s.best, s.streak);
  try { localStorage.setItem(STATS, JSON.stringify(s)); } catch { /* rien */ }
  addCoins(ok ? COINS_OK : COINS_KO, 'Trouve l’intrus');
  window.dispatchEvent(new CustomEvent('defi:changed'));
  return next;
}
