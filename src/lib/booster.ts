// « Booster du jour » : un booster virtuel par jour, d'une vraie extension (la même pour tout le monde).
// Jeu gratuit, sans achat ni gain réel : seule la dernière carte peut être rangée dans le classeur.
// Les cartes sont tirées au hasard dans la liste de l'extension (TCGdex) ; la dernière a plus de chances d'être rare.

import { getCard, getSet, priceFor, type Card, type CardBrief } from './tcgdex';
import { todayNumber } from './mystery';

/** Extensions proposées, une par jour à tour de rôle. */
export const BOOSTER_SETS = ['sv03.5', 'sv08.5', 'me01', 'swsh7', 'sv04.5', 'me02', 'swsh12.5', 'sv06', '30th', 'me02.5', 'sv02', 'swsh11', 'sv01', 'me03', 'swsh9', 'me04', 'sv09', 'me05', 'swsh12', 'sv10'];

/** Chances pour la dixième carte (affichées sur la page). */
export const RATES = { top: 0.03, chase: 0.12, upper: 0.3 };
/** Bonus (7ᵉ jour d'affilée ou quêtes de la veille terminées) : chances augmentées pour la dixième carte. */
export const BOOST_RATES = { top: 0.08, chase: 0.22, upper: 0.35 };

const regularSet = (n: number) => BOOSTER_SETS[((n - 1) % BOOSTER_SETS.length + BOOSTER_SETS.length) % BOOSTER_SETS.length];

/* ---------- Événements ---------- */
/** Extensions d'époque (1999-2000) : numéros des cartes holo et rares, l'ordre n'étant pas celui des séries récentes. */
export const VINTAGE: Record<string, { name: string; holo: [number, number]; rare: [number, number]; last?: number }> = {
  base1: { name: 'Set de Base', holo: [1, 16], rare: [17, 22], last: 95 }, // 96 à 102 : énergies
  base2: { name: 'Jungle', holo: [1, 16], rare: [17, 32] },
  base3: { name: 'Fossile', holo: [1, 15], rare: [16, 31] },
};
/** Chances pour la dixième carte d'un booster d'époque (simulation). */
export const VINTAGE_RATES = { holo: 0.2, rare: 0.35 };
export const VINTAGE_BOOST = { holo: 0.33, rare: 0.4 };

export interface BoosterEvent { id: 'retro'; name: string; setId: string; setName: string; text: string }
/** Le n° 1 (18 octobre 2026) est un dimanche : samedi et dimanche, c'est le « Week-end rétro ». */
export const isWeekend = (n: number) => { const w = (((n - 1) % 7) + 7) % 7; return w === 0 || w === 6; };
export function eventOfDay(n = todayNumber()): BoosterEvent | null {
  if (!isWeekend(n)) return null;
  const ids = Object.keys(VINTAGE);
  const setId = ids[Math.floor(n / 7) % ids.length];
  return { id: 'retro', name: 'Week-end rétro', setId, setName: VINTAGE[setId].name, text: `Ce week-end, le booster du jour vient de l'extension ${VINTAGE[setId].name} de 1999-2000 : une carte holo d'époque dans un booster sur cinq.` };
}
/** Prochain événement (pour l'annoncer). */
export function nextEvent(n = todayNumber()): { inDays: number; ev: BoosterEvent } | null {
  for (let k = 0; k < 8; k++) { const ev = eventOfDay(n + k); if (ev) return { inDays: k, ev }; }
  return null;
}

export const setOfDay = (n = todayNumber()) => eventOfDay(n)?.setId ?? regularSet(n);

export interface BoosterState { day: number; setId: string; setName: string; cards: string[]; opened: boolean; claimed: boolean; boost?: boolean; event?: 'retro' }
const KEY = 'holocote.booster.v1';

export function getBooster(): BoosterState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as BoosterState | null;
    return s && s.day === todayNumber() && Array.isArray(s.cards) ? s : null;
  } catch { return null; }
}
export function saveBooster(s: BoosterState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* rien */ }
}

interface SetDetail { id: string; name: string; cardCount?: { official?: number; total?: number }; cards?: CardBrief[] }

async function setDetail(id: string): Promise<SetDetail | null> {
  for (const lang of ['fr', 'en']) {
    const d = await getSet(id, lang as 'fr' | 'en').catch(() => null);
    if (d?.cards?.length) return d;
  }
  return null;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Tire un nouveau booster : 9 cartes de l'extension, puis une 10ᵉ « carte à gagner » plus souvent rare. */
export async function drawBooster(opts: { save?: boolean; setId?: string; boost?: boolean } = {}): Promise<BoosterState | null> {
  const day = todayNumber();
  const setId = opts.setId ?? setOfDay(day);
  const d = await setDetail(setId);
  if (!d?.cards?.length) return null;
  const official = d.cardCount?.official ?? d.cards.length;
  const num = (c: CardBrief) => (/^\d+$/.test(c.localId) ? Number(c.localId) : 0);
  const vintage = VINTAGE[setId];
  if (vintage) {
    const inR = (c: CardBrief, [a, b]: [number, number]) => num(c) >= a && num(c) <= b;
    const holo = d.cards.filter((c) => inR(c, vintage.holo));
    const rare = d.cards.filter((c) => inR(c, vintage.rare));
    const rest = d.cards.filter((c) => num(c) > vintage.rare[1] && num(c) <= (vintage.last ?? 999));
    if (rest.length < 10 || !holo.length) return null;
    const nine = new Set<string>();
    while (nine.size < 9) nine.add(pick(rest).id);
    const R = opts.boost ? VINTAGE_BOOST : VINTAGE_RATES;
    const r = Math.random();
    let last = r < R.holo ? pick(holo) : r < R.holo + R.rare && rare.length ? pick(rare) : pick(rest);
    while (nine.has(last.id)) last = pick(rest);
    const s: BoosterState = { day, setId, setName: d.name || vintage.name, cards: [...nine, last.id], opened: false, claimed: false, boost: !!opts.boost, event: eventOfDay(day)?.setId === setId ? 'retro' : undefined };
    if (opts.save !== false) saveBooster(s);
    return s;
  }
  const main = d.cards.filter((c) => num(c) > 0 && num(c) <= official);
  const chase = d.cards.filter((c) => num(c) > official);
  if (main.length < 10) return null;
  const chosen = new Set<string>();
  while (chosen.size < 9) chosen.add(pick(main).id);
  // Dernière carte, chances proches d'un vrai booster (voir RATES) : les plus belles restent rares.
  const R = opts.boost ? BOOST_RATES : RATES;
  const r = Math.random();
  const top = chase.slice(-Math.max(3, Math.ceil(chase.length / 5)));
  const rest = chase.filter((c) => !top.includes(c));
  const upper = main.slice(Math.floor(main.length * 0.6));
  let last = r < R.top && top.length ? pick(top)
    : r < R.top + R.chase && (rest.length || top.length) ? pick(rest.length ? rest : top)
      : r < R.top + R.chase + R.upper ? pick(upper)
        : pick(main);
  while (chosen.has(last.id)) last = pick(main);
  const s: BoosterState = { day, setId, setName: d.name, cards: [...chosen, last.id], opened: false, claimed: false, boost: !!opts.boost };
  if (opts.save !== false) saveBooster(s);
  return s;
}

export interface Pulled { id: string; card: Card | null; value?: number; unit?: 'EUR' | 'USD' }

/** Détails et cotes des cartes tirées (français, sinon anglais). */
export async function loadPulled(ids: string[]): Promise<Pulled[]> {
  return Promise.all(ids.map(async (id) => {
    const card = (await getCard(id, 'fr').catch(() => null)) ?? (await getCard(id, 'en').catch(() => null));
    const p = card ? priceFor(card, 'normal') : null;
    return { id, card, value: p?.value, unit: p?.unit };
  }));
}

/** Niveau d'effet pour la révélation de la dernière carte. */
export function hitLevel(c: Card | null): 0 | 1 | 2 | 3 {
  const r = (c?.rarity ?? '').toLowerCase();
  if (c && VINTAGE[c.set?.id ?? '']) return c.id === 'base1-4' ? 3 : /holo/.test(r) ? 2 : /rare/.test(r) ? 1 : 0;
  if (/hyper|mega hyper|secr|gold|dor|special illustration|illustration sp/.test(r)) return 3;
  if (/ultra|illustration rare|double|vmax|vstar|ex\b|full/.test(r)) return 2;
  if (/rare|holo/.test(r)) return 1;
  return 0;
}
