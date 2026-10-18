// Favoris : cartes suivies par l'utilisateur (cours, hausse ou baisse).
// Stockés uniquement dans le navigateur, comme la collection.

import type { Lang } from './tcgdex';

export interface FavoriteInfo {
  name: string;
  image?: string;
  setName?: string;
  rarity?: string;
  priceAtAdd?: number;      // cours au moment de l'ajout, pour la variation « depuis l'ajout »
  unit?: 'EUR' | 'USD';
}

export interface Favorite extends FavoriteInfo {
  cardId: string;
  lang: Lang;
  addedAt: number;
  refPrice?: number;        // cours de référence des alertes (dernière alerte vue), sinon priceAtAdd
  targetBelow?: number;     // alerte si le cours descend à ce prix ou moins
  targetAbove?: number;     // alerte si le cours monte à ce prix ou plus
}

const KEY = 'holocote.favorites.v1';
const EVENT = 'holocote:favorites';
let memory: Favorite[] = [];

function load(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = validate(JSON.parse(raw));
  } catch { /* stockage indisponible : on garde la mémoire */ }
  return memory;
}

function save(list: Favorite[]) {
  memory = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* rien */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

const same = (f: Favorite, cardId: string, lang: Lang) => f.cardId === cardId && f.lang === lang;

export const getFavorites = (): Favorite[] => [...load()].sort((a, b) => b.addedAt - a.addedAt);
export const countFavorites = (): number => load().length;
export const isFavorite = (cardId: string, lang: Lang): boolean => load().some((f) => same(f, cardId, lang));

export function addFavorite(cardId: string, lang: Lang, info: FavoriteInfo) {
  const list = load();
  if (list.some((f) => same(f, cardId, lang))) return;
  save([...list, { ...info, cardId, lang, addedAt: Date.now() }]);
}

export function removeFavorite(cardId: string, lang: Lang) {
  save(load().filter((f) => !same(f, cardId, lang)));
}

/** Met à jour le cours de référence des alertes (après que l'utilisateur les a vues). */
export function setRefPrices(prices: { cardId: string; lang: Lang; price: number }[]) {
  const list = load().map((f) => {
    const p = prices.find((x) => same(f, x.cardId, x.lang));
    return p ? { ...f, refPrice: p.price } : f;
  });
  save(list);
}

/** Prix cibles d'une carte (undefined = pas de cible). */
export function setTargets(cardId: string, lang: Lang, t: { below?: number; above?: number }) {
  save(load().map((f) => (same(f, cardId, lang) ? { ...f, targetBelow: t.below, targetAbove: t.above } : f)));
}

/** Prévient quand les favoris changent (dans cet onglet ou un autre). */
export function onFavoritesChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage); };
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

/**
 * Bouton étoile. `getInfo` fournit nom, image, cours… au moment de l'ajout
 * (peut être asynchrone : les détails de la carte sont alors chargés au clic).
 */
export function favButton(
  cardId: string,
  lang: Lang,
  getInfo: () => FavoriteInfo | Promise<FavoriteInfo>,
  opts: { label?: boolean; className?: string } = {},
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = ['fav-btn', opts.className].filter(Boolean).join(' ');
  let busy = false;
  const paint = () => {
    const on = isFavorite(cardId, lang);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Retirer des favoris' : 'Ajouter aux favoris';
    b.setAttribute('aria-label', b.title);
    b.innerHTML = STAR + (opts.label ? `<span>${on ? 'Dans mes favoris' : 'Ajouter aux favoris'}</span>` : '');
  };
  paint();
  b.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (isFavorite(cardId, lang)) {
      removeFavorite(cardId, lang);
    } else {
      busy = true;
      b.setAttribute('aria-pressed', 'true'); // retour visuel immédiat
      try {
        addFavorite(cardId, lang, await getInfo());
      } catch {
        /* infos indisponibles : on n'ajoute rien */
      } finally {
        busy = false;
      }
    }
    paint();
  });
  // Les listes (Marché, recherche…) recréent leurs boutons : un bouton retiré de la page se désabonne.
  let seen = false;
  const off = onFavoritesChange(() => {
    if (!b.isConnected) { if (seen) off(); return; }
    seen = true;
    paint();
  });
  return b;
}

function validate(data: unknown): Favorite[] {
  if (!Array.isArray(data)) return [];
  const out: Favorite[] = [];
  for (const r of data.slice(0, 1000) as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.cardId !== 'string' || !/^[\w.\-!%?]+$/.test(r.cardId)) continue;
    if (r.lang !== 'fr' && r.lang !== 'en') continue;
    if (typeof r.name !== 'string' || !r.name) continue;
    const str = (v: unknown, n = 200) => (typeof v === 'string' && v ? v.slice(0, n) : undefined);
    const image = str(r.image, 300);
    out.push({
      cardId: r.cardId,
      lang: r.lang,
      name: r.name.slice(0, 200),
      image: image && image.startsWith('https://assets.tcgdex.net/') ? image : undefined,
      setName: str(r.setName),
      rarity: str(r.rarity, 80),
      priceAtAdd: typeof r.priceAtAdd === 'number' && r.priceAtAdd > 0 ? r.priceAtAdd : undefined,
      unit: r.unit === 'USD' ? 'USD' : r.unit === 'EUR' ? 'EUR' : undefined,
      refPrice: typeof r.refPrice === 'number' && r.refPrice > 0 ? r.refPrice : undefined,
      targetBelow: typeof r.targetBelow === 'number' && r.targetBelow > 0 ? r.targetBelow : undefined,
      targetAbove: typeof r.targetAbove === 'number' && r.targetAbove > 0 ? r.targetAbove : undefined,
      addedAt: typeof r.addedAt === 'number' ? r.addedAt : Date.now(),
    });
  }
  return out;
}
