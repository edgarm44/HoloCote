// Objectifs de collection par extension : combien de cartes différentes de chaque extension sont au classeur.

import { getItems } from './collection';
import { listSets, type Lang } from './tcgdex';

export const setIdOf = (cardId: string) => cardId.slice(0, Math.max(0, cardId.lastIndexOf('-'))) || cardId;
const numOf = (cardId: string) => cardId.slice(cardId.lastIndexOf('-') + 1);

const TOTALS = 'holocote.settotals.v1';
type Totals = Record<string, { name: string; official: number }>;

export function cachedTotals(): Totals {
  try { const v = JSON.parse(localStorage.getItem(TOTALS) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

export interface SetRow { id: string; name: string; owned: number; inSet: number; extra: number; official: number; pct: number; logo?: string }

/** Avancement par extension, à partir des cartes du classeur (cartes identiques FR/EN comptées une fois). */
export function computeRows(totals: Totals, names: Map<string, string> = new Map()): SetRow[] {
  const by = new Map<string, Set<string>>();
  const label = new Map<string, string>();
  for (const it of getItems()) {
    const id = setIdOf(it.cardId);
    if (!by.has(id)) by.set(id, new Set());
    by.get(id)!.add(numOf(it.cardId));
    if (it.setName && !label.has(id)) label.set(id, it.setName);
  }
  const rows: SetRow[] = [];
  for (const [id, nums] of by) {
    const official = totals[id]?.official ?? 0;
    const inSet = [...nums].filter((n) => !/^\d+$/.test(n) || !official || Number(n) <= official).length;
    rows.push({
      id,
      name: names.get(id) ?? totals[id]?.name ?? label.get(id) ?? id,
      owned: nums.size,
      inSet,
      extra: nums.size - inSet,
      official,
      pct: official ? Math.min(1, inSet / official) : 0,
    });
  }
  return rows.sort((a, b) => b.pct - a.pct || b.owned - a.owned);
}

/** Charge les totaux officiels des extensions (et les garde pour les succès). */
export async function loadTotals(lang: Lang = 'fr'): Promise<{ totals: Totals; logos: Map<string, string> }> {
  const totals = cachedTotals();
  const logos = new Map<string, string>();
  const merge = (sets: Awaited<ReturnType<typeof listSets>>, overwriteName: boolean) => {
    for (const s of sets) {
      const official = s.cardCount?.official ?? 0;
      if (!official) continue;
      if (!totals[s.id] || overwriteName) totals[s.id] = { name: s.name, official };
      if (s.logo && !logos.has(s.id)) logos.set(s.id, s.logo);
    }
  };
  const other: Lang = lang === 'fr' ? 'en' : 'fr';
  merge(await listSets(other).catch(() => []), false);
  merge(await listSets(lang).catch(() => []), true);
  // On ne garde que les extensions présentes au classeur : petit et suffisant pour les succès.
  const mine = new Set(getItems().map((i) => setIdOf(i.cardId)));
  const small: Totals = {};
  for (const id of mine) if (totals[id]) small[id] = totals[id];
  try { localStorage.setItem(TOTALS, JSON.stringify(small)); } catch { /* rien */ }
  return { totals: small, logos };
}

/** Meilleur pourcentage atteint sur une extension (pour les succès), d'après les totaux déjà connus. */
export function bestSetPct(): number {
  return computeRows(cachedTotals()).reduce((m, r) => Math.max(m, r.pct), 0);
}
