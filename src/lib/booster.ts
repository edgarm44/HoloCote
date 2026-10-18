// « Booster du jour » : un booster virtuel par jour, d'une vraie extension (la même pour tout le monde).
// Jeu gratuit, sans achat ni gain réel : seule la dernière carte peut être rangée dans le classeur.
// Les cartes sont tirées au hasard dans la liste de l'extension (TCGdex) ; la dernière a plus de chances d'être rare.

import { getCard, priceFor, type Card, type CardBrief } from './tcgdex';
import { todayNumber } from './mystery';

/** Extensions proposées, une par jour à tour de rôle. */
export const BOOSTER_SETS = ['sv03.5', 'sv08.5', 'me01', 'swsh7', 'sv04.5', 'me02', 'swsh12.5', 'sv06', '30th', 'me02.5', 'sv02', 'swsh11', 'sv01', 'me03', 'swsh9', 'me04', 'sv09', 'me05', 'swsh12', 'sv10'];

export const setOfDay = (n = todayNumber()) => BOOSTER_SETS[((n - 1) % BOOSTER_SETS.length + BOOSTER_SETS.length) % BOOSTER_SETS.length];

export interface BoosterState { day: number; setId: string; setName: string; cards: string[]; opened: boolean; claimed: boolean }
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
    const d = await fetch(`https://api.tcgdex.net/v2/${lang}/sets/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d?.cards?.length) return d;
  }
  return null;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Tire un nouveau booster : 9 cartes de l'extension, puis une 10ᵉ « carte à gagner » plus souvent rare. */
export async function drawBooster(): Promise<BoosterState | null> {
  const day = todayNumber();
  const setId = setOfDay(day);
  const d = await setDetail(setId);
  if (!d?.cards?.length) return null;
  const official = d.cardCount?.official ?? d.cards.length;
  const num = (c: CardBrief) => (/^\d+$/.test(c.localId) ? Number(c.localId) : 0);
  const main = d.cards.filter((c) => num(c) > 0 && num(c) <= official);
  const chase = d.cards.filter((c) => num(c) > official);
  if (main.length < 10) return null;
  const chosen = new Set<string>();
  while (chosen.size < 9) chosen.add(pick(main).id);
  // Dernière carte : 6 % parmi les plus rares, 24 % parmi les cartes « chasse », sinon le haut de l'extension.
  const r = Math.random();
  const top = chase.slice(-Math.max(3, Math.ceil(chase.length / 4)));
  const upper = main.slice(Math.floor(main.length * 0.6));
  let last = r < 0.06 && top.length ? pick(top) : r < 0.3 && chase.length ? pick(chase) : pick(upper);
  while (chosen.has(last.id)) last = pick(main);
  const s: BoosterState = { day, setId, setName: d.name, cards: [...chosen, last.id], opened: false, claimed: false };
  saveBooster(s);
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
  if (/hyper|mega hyper|secr|gold|dor|special illustration|illustration sp/.test(r)) return 3;
  if (/ultra|illustration rare|double|vmax|vstar|ex\b|full/.test(r)) return 2;
  if (/rare|holo/.test(r)) return 1;
  return 0;
}
