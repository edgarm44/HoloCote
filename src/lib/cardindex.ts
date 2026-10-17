// Index complet des cartes TCGdex (FR et EN), chargé une fois et partagé par le scanner et la recherche.

import { listSets, type CardBrief, type Lang } from './tcgdex';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Nom sans les suffixes de mécanique de jeu (ex, V, VMAX…). */
export function coreName(s: string): string {
  return normalize(
    s.replace(/\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.?X|Prime|Star|δ|◇|☆)\b/g, ' '),
  );
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.length >= 4 && a.includes(b)) return 0.95;
  if (a.length >= 4 && b.includes(a)) return 0.9;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

export interface IndexEntry extends CardBrief { core: string; setId: string }
export interface CardIndex { cards: IndexEntry[]; sets: Map<string, { name: string; official: number }> }

const indexes = new Map<Lang, Promise<CardIndex>>();

export function loadIndex(lang: Lang): Promise<CardIndex> {
  if (!indexes.has(lang)) {
    const p = (async () => {
      const [cards, sets] = await Promise.all([
        fetch(`https://api.tcgdex.net/v2/${lang}/cards`).then((r) => {
          if (!r.ok) throw new Error(`TCGdex ${r.status}`);
          return r.json() as Promise<CardBrief[]>;
        }),
        listSets(lang),
      ]);
      return {
        cards: cards.map((c) => ({ ...c, core: coreName(c.name), setId: c.id.slice(0, c.id.length - c.localId.length - 1) })),
        sets: new Map(sets.map((s) => [s.id, { name: s.name, official: s.cardCount?.official ?? 0 }])),
      };
    })();
    p.catch(() => indexes.delete(lang));
    indexes.set(lang, p);
  }
  return indexes.get(lang)!;
}

/** Précharge les index FR et EN (pendant que l'utilisateur vise). */
export function preloadIndexes() {
  loadIndex('fr').catch(() => {});
  loadIndex('en').catch(() => {});
}

