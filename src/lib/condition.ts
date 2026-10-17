// États de carte et coefficients indicatifs appliqués à la cote (base : Near Mint).
// Les coefficients sont des approximations du marché, affichées comme telles.

export type Condition = 'M' | 'NM' | 'EX' | 'GD' | 'PL' | 'PO';

export const CONDITIONS: { code: Condition; label: string; hint: string; factor: number }[] = [
  { code: 'M', label: 'Mint', hint: 'Parfaite, sortie du booster', factor: 1.0 },
  { code: 'NM', label: 'Near Mint', hint: 'Quasi parfaite', factor: 1.0 },
  { code: 'EX', label: 'Excellent', hint: 'Légère usure des bords', factor: 0.8 },
  { code: 'GD', label: 'Good', hint: 'Usure visible, petits plis', factor: 0.6 },
  { code: 'PL', label: 'Played', hint: 'Très jouée, rayures', factor: 0.4 },
  { code: 'PO', label: 'Poor', hint: 'Abîmée', factor: 0.2 },
];

export const conditionFactor = (c: Condition): number =>
  CONDITIONS.find((x) => x.code === c)?.factor ?? 1;

export const conditionLabel = (c: Condition): string =>
  CONDITIONS.find((x) => x.code === c)?.label ?? c;

export const isCondition = (c: unknown): c is Condition =>
  typeof c === 'string' && CONDITIONS.some((x) => x.code === c);
