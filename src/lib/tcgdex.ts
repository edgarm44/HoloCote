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
let fresh = false;

/** Oublie les réponses déjà chargées et redemande les cotes au serveur (bouton « Actualiser »). */
export function clearApiCache() {
  cache.clear();
  fresh = true;
}

async function get<T>(path: string): Promise<T> {
  const url = `${API}${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, fresh ? { cache: 'no-cache' } : undefined).then(async (r) => {
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

export type Finish = 'normal' | 'reverse';

export interface PriceInfo {
  value: number;      // cote retenue
  low?: number;
  unit: 'EUR' | 'USD';
  source: 'Cardmarket' | 'TCGplayer';
  updated?: string;
  unsure?: boolean;   // repères trop dispersés ou trop peu nombreux : cote à prendre avec prudence
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;

/** Médiane des valeurs disponibles : résiste à une vente isolée anormale. */
function median(values: (number | undefined)[]): number | undefined {
  const v = values.filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function cardmarket(card: Card, holo: boolean): PriceInfo | null {
  const cm = card.pricing?.cardmarket;
  if (!cm) return null;
  const k = (f: string) => num((cm as Record<string, unknown>)[holo ? `${f}-holo` : f]);
  // Cardmarket : médiane de la tendance, du prix moyen de vente et des moyennes 7 et 30 jours.
  // La moyenne de la veille (avg1) est exclue : une seule vente peut la fausser.
  // Vérifié sur données réelles : la tendance seule peut être aberrante (Dracaufeu set de base :
  // tendance 78 € pour des ventes moyennes de 420 à 770 €).
  const refs = [k('trend'), k('avg'), k('avg7'), k('avg30')].filter((x): x is number => x !== undefined);
  const value = median(refs) ?? k('avg1');
  // Contrôle de cohérence : moins de deux repères, ou un écart de plus de 3 fois entre eux.
  const unsure = refs.length < 2 || Math.max(...refs) / Math.min(...refs) > 3;
  return value ? { value, low: k('low'), unit: 'EUR', source: 'Cardmarket', updated: cm.updated, unsure } : null;
}

function tcgplayer(card: Card, keys: string[]): PriceInfo | null {
  const tp = card.pricing?.tcgplayer;
  if (!tp) return null;
  for (const key of keys) {
    const v = tp[key];
    if (v && typeof v === 'object') {
      const value = num(v.marketPrice) ?? num(v.midPrice);
      if (value) return { value, low: num(v.lowPrice), unit: 'USD', source: 'TCGplayer', updated: tp.updated as string | undefined };
    }
  }
  return null;
}

const TP_NORMAL = ['normal', 'unlimited', '1st-edition'];
const TP_HOLO = ['holofoil', 'unlimited-holofoil', '1st-edition-holofoil'];
const TP_REVERSE = ['reverse-holofoil', 'reverse'];

/**
 * Cote d'une carte pour une finition.
 * - normal : version standard (ou holo pour une carte qui n'existe qu'en holo) ;
 * - reverse : version « reverse holo » (champs « -holo » de Cardmarket).
 * Cardmarket (EUR) en priorité, TCGplayer (USD) en secours.
 */
export function priceFor(card: Card, finish: Finish = 'normal'): PriceInfo | null {
  const v = card.variants ?? {};
  const holoOnly = v.normal === false && v.holo === true;
  if (finish === 'reverse') {
    return cardmarket(card, true) ?? tcgplayer(card, TP_REVERSE);
  }
  return (
    cardmarket(card, false) ??
    (holoOnly ? cardmarket(card, true) : null) ??
    tcgplayer(card, holoOnly ? [...TP_HOLO, ...TP_NORMAL] : [...TP_NORMAL, ...TP_HOLO])
  );
}

/** La carte existe-t-elle en reverse holo avec une cote distincte ? */
export function hasReverse(card: Card): boolean {
  const v = card.variants ?? {};
  if (v.reverse === false) return false;
  if (v.normal === false && v.holo === true && !cardmarket(card, false)) return false;
  return !!(cardmarket(card, true) ?? tcgplayer(card, TP_REVERSE));
}

export const bestPrice = (card: Card) => priceFor(card, 'normal');

export function formatPrice(value: number, unit: 'EUR' | 'USD'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: unit, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
