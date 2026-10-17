// Rareté officielle (texte fourni par TCGdex) + badge maison basé sur la cote.

export type Tier = 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret';

/** Classe la rareté officielle (FR ou EN) dans un palier visuel. */
export function rarityTier(rarity?: string): Tier {
  const r = (rarity ?? '').toLowerCase();
  if (/(secr|hyper|illustration sp|special illustration|gold|dor|shiny ultra|méga hyper|mega hyper)/.test(r)) return 'secret';
  if (/(ultra|double|illustration|full art|vmax|vstar|\bex\b|\bgx\b|\bv\b|radiant|radieux|ace spec|amazing|magnifique|prism|shiny|chromatique)/.test(r)) return 'ultra';
  if (/(peu commun|uncommon)/.test(r)) return 'uncommon';
  if (/(rare|holo|promo)/.test(r)) return 'rare';
  return 'common';
}

export const tierLabel: Record<Tier, string> = {
  common: 'Commune',
  uncommon: 'Peu commune',
  rare: 'Rare',
  ultra: 'Ultra rare',
  secret: 'Secrète',
};

export interface ValueBadge {
  label: string;
  level: 0 | 1 | 2 | 3 | 4;
}

/** Badge « cote » maison, indépendant de la rareté imprimée. Seuils en euros. */
export function valueBadge(eur: number | null | undefined): ValueBadge {
  if (eur == null) return { label: 'Cote inconnue', level: 0 };
  if (eur < 1) return { label: 'Petite cote', level: 0 };
  if (eur < 10) return { label: 'Cote correcte', level: 1 };
  if (eur < 50) return { label: 'Belle cote', level: 2 };
  if (eur < 200) return { label: 'Grosse cote', level: 3 };
  return { label: 'Trésor', level: 4 };
}

/**
 * Conversion approximative USD -> EUR, utilisée seulement pour classer (badge, tri, pépite)
 * quand une carte n'a qu'une cote TCGplayer. Les prix en dollars restent affichés en dollars.
 * Référence BCE du 18 juin 2026 : 1 € = 1,1461 $, soit 1 $ ≈ 0,87 €.
 */
export const USD_TO_EUR = 0.87;
