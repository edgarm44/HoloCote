// Accès à l'API publique TCGdex (https://tcgdex.dev), appelée depuis le navigateur.
// Les images ne sont jamais copiées : on affiche directement les URLs de TCGdex.

export type Lang = 'fr' | 'en';
const API = 'https://api.tcgdex.net/v2';

export interface CardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface CardmarketPrice {
  updated?: string;
  unit?: string;
  avg?: number | null;
  low?: number | null;
  trend?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  'avg-holo'?: number | null;
  'low-holo'?: number | null;
  'trend-holo'?: number | null;
}

export interface TcgplayerVariant {
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
}

export interface Card extends CardBrief {
  category?: string;
  illustrator?: string;
  rarity?: string;
  hp?: number;
  types?: string[];
  set: {
    id: string;
    name: string;
    logo?: string;
    symbol?: string;
    cardCount?: { official?: number; total?: number };
  };
  variants?: Record<string, boolean>;
  pricing?: {
    cardmarket?: CardmarketPrice | null;
    tcgplayer?: ({ updated?: string; unit?: string } & Record<string, TcgplayerVariant | string | undefined>) | null;
  };
}

export interface SetBrief {
  id: string;
  name: string;
  logo?: string;
  cardCount: { official: number; total: number };
}

const cache = new Map<string, Promise<unknown>>();

async function get<T>(path: string): Promise<T> {
  const url = `${API}${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`TCGdex ${r.status}`);
        return r.json();
      }).catch((e) => {
        cache.delete(url);
        throw e;
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

/** Recherche par nom (correspondance partielle, insensible à la casse côté TCGdex). */
export async function searchCards(name: string, lang: Lang, limit = 36): Promise<CardBrief[]> {
  const q = new URLSearchParams({
    name,
    'pagination:page': '1',
    'pagination:itemsPerPage': String(limit),
  });
  const res = await get<CardBrief[] | null>(`/${lang}/cards?${q}`);
  return res ?? [];
}

export async function getCard(id: string, lang: Lang): Promise<Card | null> {
  return get<Card | null>(`/${lang}/cards/${encodeURIComponent(id)}`);
}

export async function listSets(lang: Lang): Promise<SetBrief[]> {
  return (await get<SetBrief[] | null>(`/${lang}/sets`)) ?? [];
}

/** URL d'image TCGdex (qualité basse pour les grilles, haute pour la fiche). */
export function imageUrl(base: string | undefined, quality: 'low' | 'high' = 'low'): string | null {
  return base ? `${base}/${quality}.webp` : null;
}

export interface PriceInfo {
  value: number;      // cote retenue
  low?: number;
  unit: 'EUR' | 'USD';
  source: 'Cardmarket' | 'TCGplayer';
  updated?: string;
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;

/**
 * Cote d'une carte : tendance Cardmarket (EUR) en priorité, sinon moyenne,
 * puis prix « market » TCGplayer (USD) en secours.
 */
export function bestPrice(card: Card): PriceInfo | null {
  const cm = card.pricing?.cardmarket;
  if (cm) {
    const value = num(cm.trend) ?? num(cm.avg30) ?? num(cm.avg) ?? num(cm['trend-holo']) ?? num(cm['avg-holo']);
    if (value) {
      return { value, low: num(cm.low) ?? num(cm['low-holo']), unit: 'EUR', source: 'Cardmarket', updated: cm.updated };
    }
  }
  const tp = card.pricing?.tcgplayer;
  if (tp) {
    for (const key of ['normal', 'holofoil', 'reverse-holofoil', '1st-edition-holofoil', '1st-edition']) {
      const v = tp[key];
      if (v && typeof v === 'object') {
        const value = num(v.marketPrice) ?? num(v.midPrice);
        if (value) return { value, low: num(v.lowPrice), unit: 'USD', source: 'TCGplayer', updated: tp.updated as string | undefined };
      }
    }
  }
  return null;
}

export function formatPrice(value: number, unit: 'EUR' | 'USD'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: unit, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
