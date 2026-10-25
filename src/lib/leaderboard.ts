// Classement des classeurs : ta collection face à des rivaux FICTIFS.
// Les rivaux sont inventés par HoloDex (pseudos, classeurs) et présentés comme tels sur la page ;
// leurs cartes sont de vraies cartes et leur valeur est calculée avec les cotes du jour.
// Identifiants de cartes vérifiés dans la base TCGdex (copie du 3 octobre 2026).

import type { Condition } from './condition';
import { conditionFactor } from './condition';
import { getCard, priceFor, type Lang } from './tcgdex';
import { getItems } from './collection';

export interface RivalCard { id: string; cond: Condition; qty?: number }
export interface Rival { id: string; name: string; motto: string; hue: number; cards: RivalCard[] }

export const RIVALS: Rival[] = [
  { id: 'kai', name: 'KaiShiny', motto: 'Je ne garde que les cartes qui brillent.', hue: 190, cards: [
    { id: 'base1-4', cond: 'EX' }, { id: 'sv03.5-199', cond: 'NM' }, { id: 'me02-130', cond: 'NM' }, { id: 'swsh7-215', cond: 'GD' },
    { id: 'sv08.5-161', cond: 'NM' }, { id: '30th-150', cond: 'NM' }, { id: 'sv03.5-133', cond: 'NM', qty: 3 } ] },
  { id: 'lina', name: 'Lina_Holo', motto: 'Team Évoli depuis toujours.', hue: 320, cards: [
    { id: 'swsh7-215', cond: 'NM' }, { id: 'sv03.5-205', cond: 'NM' }, { id: 'me01-188', cond: 'NM' }, { id: 'sv08.5-167', cond: 'NM' },
    { id: 'sv04.5-232', cond: 'EX' }, { id: '30th-153', cond: 'NM' }, { id: '30th-118', cond: 'NM', qty: 2 } ] },
  { id: 'rayan', name: 'Rayan.Mega', motto: 'Toutes les Méga, sinon rien.', hue: 265, cards: [
    { id: 'me02-130', cond: 'EX' }, { id: 'me02-125', cond: 'NM' }, { id: 'me01-187', cond: 'NM' }, { id: 'me03-124', cond: 'NM' },
    { id: 'me05-120', cond: 'NM' }, { id: 'me04-122', cond: 'EX' } ] },
  { id: 'ines', name: 'Inès Reverse', motto: 'Les illustrations spéciales, c\'est de l\'art.', hue: 150, cards: [
    { id: 'sv03-223', cond: 'NM' }, { id: 'sv03.5-198', cond: 'NM' }, { id: 'swsh7-218', cond: 'GD' }, { id: 'sv10-232', cond: 'NM' },
    { id: 'sv09-187', cond: 'NM' }, { id: 'sv03.5-143', cond: 'NM', qty: 2 } ] },
  { id: 'tom', name: 'Tom_Booster', motto: 'Un booster par semaine, minimum.', hue: 30, cards: [
    { id: 'sv04.5-234', cond: 'EX' }, { id: 'sv08-219', cond: 'NM' }, { id: 'sv03-125', cond: 'NM' }, { id: 'sv06-130', cond: 'NM' },
    { id: 'me01-178', cond: 'GD' }, { id: 'sv03.5-129', cond: 'NM', qty: 4 }, { id: 'me02-076', cond: 'NM', qty: 2 } ] },
  { id: 'noa', name: 'Noa Foil', motto: '30 ans de Pokémon, 30 cartes préférées.', hue: 50, cards: [
    { id: '30th-152', cond: 'NM' }, { id: '30th-154', cond: 'NM' }, { id: '30th-151', cond: 'EX' }, { id: '30th-119', cond: 'NM' },
    { id: '30th-117', cond: 'NM', qty: 2 }, { id: 'sv03.5-166', cond: 'NM' } ] },
  { id: 'max', name: 'MaxDracoKing', motto: 'Dracaufeu dans toutes ses versions.', hue: 12, cards: [
    { id: 'sv03.5-183', cond: 'EX' }, { id: 'sv03-125', cond: 'GD' }, { id: 'base1-46', cond: 'PL' }, { id: 'sv03.5-148', cond: 'NM' },
    { id: 'sv03.5-147', cond: 'NM', qty: 2 } ] },
  { id: 'zoe', name: 'Zoé.Mint', motto: 'Near Mint ou rien.', hue: 175, cards: [
    { id: 'me01-178', cond: 'M' }, { id: 'sv08.5-165', cond: 'NM' }, { id: 'me01-112', cond: 'M' }, { id: 'me02-083', cond: 'M' },
    { id: 'sv08.5-087', cond: 'NM' } ] },
  { id: 'kenji', name: 'Kenji Collect', motto: 'Team Rocket pour la vie.', hue: 0, cards: [
    { id: 'sv10-231', cond: 'EX' }, { id: 'sv09-185', cond: 'GD' }, { id: 'sv10.5b-166', cond: 'PL' }, { id: 'me02.5-100', cond: 'NM', qty: 3 },
    { id: 'sv01-165', cond: 'NM' } ] },
  { id: 'lou', name: 'Lou Pépite', motto: 'J\'ai trouvé mes cartes au grenier de papi.', hue: 95, cards: [
    { id: 'base1-16', cond: 'GD' }, { id: 'base1-6', cond: 'PL' }, { id: 'base1-7', cond: 'GD' }, { id: 'base1-70', cond: 'PL' },
    { id: 'base1-63', cond: 'PO' } ] },
  { id: 'nina', name: 'Nina Débute', motto: 'Mon premier classeur !', hue: 290, cards: [
    { id: 'sv03.5-133', cond: 'NM' }, { id: 'sv03.5-137', cond: 'NM' }, { id: 'me01-105', cond: 'EX' }, { id: 'sv08.5-090', cond: 'NM' },
    { id: '30th-125', cond: 'NM' } ] },
  { id: 'bulbi', name: 'Bulbi_Fan', motto: 'Bulbizarre est sous-coté, retenez-le.', hue: 120, cards: [
    { id: 'base1-44', cond: 'GD' }, { id: 'sv03.5-129', cond: 'EX' }, { id: 'me01-111', cond: 'NM' }, { id: 'me02-082', cond: 'GD' } ] },
  { id: 'leo', name: 'Léo Malchance', motto: 'Jamais une rare dans mes boosters…', hue: 220, cards: [
    { id: 'base1-58', cond: 'PL' }, { id: 'base1-69', cond: 'PO' }, { id: 'base1-82', cond: 'GD' }, { id: 'sv02-100', cond: 'PL' },
    { id: 'me05-071', cond: 'GD' } ] },
  { id: 'hugo', name: 'Hugo P\'tit Classeur', motto: 'Petit classeur, grand cœur.', hue: 240, cards: [
    { id: 'sv01-160', cond: 'PO' }, { id: 'me05-064', cond: 'PL' }, { id: 'me02.5-100', cond: 'GD' } ] },
];

export interface League { key: string; name: string; min: number }
export const LEAGUES: League[] = [
  { key: 'legend', name: 'Légende', min: 1500 },
  { key: 'diamond', name: 'Diamant', min: 500 },
  { key: 'gold', name: 'Or', min: 100 },
  { key: 'silver', name: 'Argent', min: 20 },
  { key: 'bronze', name: 'Bronze', min: 0 },
];
export const leagueOf = (v: number) => LEAGUES.find((l) => v >= l.min) ?? LEAGUES[LEAGUES.length - 1];

export interface EntryCard { id: string; lang: Lang; name: string; image?: string; cond: Condition; qty: number; value?: number }
export interface Entry {
  id: string;            // 'me' pour l'utilisateur
  name: string;
  motto?: string;
  hue: number;
  isMe: boolean;
  value: number;         // valeur estimée (EUR)
  count: number;
  star?: EntryCard;      // carte la plus chère
  cards: EntryCard[];
  league: League;
}

/* Pseudo de l'utilisateur (dans le navigateur uniquement) */
const PSEUDO_KEY = 'holocote.pseudo.v1';
export function getPseudo(): string {
  try { return (localStorage.getItem(PSEUDO_KEY) || '').slice(0, 20) || 'Toi'; } catch { return 'Toi'; }
}
export function setPseudo(p: string) {
  try { localStorage.setItem(PSEUDO_KEY, p.trim().slice(0, 20)); } catch { /* rien */ }
}

export async function priced(list: { id: string; lang: Lang; cond: Condition; qty: number; finish?: 'normal' | 'reverse' }[]): Promise<EntryCard[]> {
  const out: EntryCard[] = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < list.length) {
      const k = i++;
      const it = list[k];
      let card = await getCard(it.id, it.lang).catch(() => null);
      if (!card && it.lang === 'fr') card = await getCard(it.id, 'en').catch(() => null);
      const p = card ? priceFor(card, it.finish ?? 'normal') : null;
      // Seules les cotes en euros comptent, pour comparer ce qui est comparable.
      const unit = p && p.unit === 'EUR' ? p.value * conditionFactor(it.cond) : undefined;
      out[k] = { id: it.id, lang: it.lang, name: card?.name ?? it.id, image: card?.image, cond: it.cond, qty: it.qty, value: unit };
    }
  }));
  return out;
}

function toEntry(base: Omit<Entry, 'value' | 'count' | 'star' | 'league'>): Entry {
  const value = base.cards.reduce((s, c) => s + (c.value ?? 0) * c.qty, 0);
  const count = base.cards.reduce((s, c) => s + c.qty, 0);
  const star = [...base.cards].filter((c) => c.value !== undefined).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  return { ...base, value, count, star, league: leagueOf(value) };
}

/** Construit le classement complet (rivaux + utilisateur), trié par valeur. */
export async function buildLeaderboard(): Promise<Entry[]> {
  const mine = getItems().map((i) => ({ id: i.cardId, lang: i.lang, cond: i.condition, qty: i.quantity, finish: i.finish }));
  const [me, ...rivals] = await Promise.all([
    priced(mine),
    ...RIVALS.map((r) => priced(r.cards.map((c) => ({ id: c.id, lang: 'fr' as Lang, cond: c.cond, qty: c.qty ?? 1 })))),
  ]);
  const entries: Entry[] = [
    toEntry({ id: 'me', name: getPseudo(), hue: 190, isMe: true, cards: me }),
    ...RIVALS.map((r, i) => toEntry({ id: r.id, name: r.name, motto: r.motto, hue: r.hue, isMe: false, cards: rivals[i] })),
  ];
  return entries.sort((a, b) => b.value - a.value || (a.isMe ? -1 : 1));
}

/* Évolution du rang depuis la dernière visite */
const RANK_KEY = 'holocote.rank.v1';
export function rankDelta(rank: number): number | undefined {
  let prev: number | undefined;
  try { const v = Number(localStorage.getItem(RANK_KEY)); prev = Number.isFinite(v) && v > 0 ? v : undefined; } catch { /* rien */ }
  try { localStorage.setItem(RANK_KEY, String(rank)); } catch { /* rien */ }
  return prev === undefined ? undefined : prev - rank;
}
