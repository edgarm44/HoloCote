// Analyse « Opportunités » : repères de prix calculés à partir des moyennes Cardmarket (via TCGdex).
// Ce sont des indicateurs descriptifs, pas des conseils d'achat : TCGdex ne fournit que trois repères
// (moyenne 30 jours, moyenne 7 jours, cours actuel) et un plus bas prix proposé.

import type { Quote } from './market';

export type Verdict = 'window' | 'rebound' | 'falling' | 'hot' | 'normal';

export const VERDICTS: Record<Verdict, { label: string; short: string; tone: 'up' | 'down' | 'gold' | 'muted' | 'cyan' }> = {
  window: { label: 'Fenêtre intéressante', short: 'Sous sa moyenne', tone: 'up' },
  rebound: { label: 'Ça repart', short: 'Rebond', tone: 'cyan' },
  falling: { label: 'Chute en cours : patience', short: 'En chute', tone: 'down' },
  hot: { label: 'Au plus haut : attendre', short: 'Surchauffe', tone: 'gold' },
  normal: { label: 'Prix habituel', short: 'Stable', tone: 'muted' },
};

export interface Analysis {
  q: Quote;
  verdict: Verdict;
  score: number;          // 0 à 100 : plus c'est haut, plus le prix est bas par rapport à ses repères
  vsMonth?: number;       // cours vs moyenne 30 j (%)
  vsWeek?: number;        // cours vs moyenne 7 j (%)
  trend?: number;         // moyenne 7 j vs moyenne 30 j (%)
  spread?: number;        // cours vs plus bas proposé (%)
  reasons: string[];
  target: number;         // prix cible suggéré pour une alerte
}

const pct = (a?: number, b?: number) => (a !== undefined && b ? ((a - b) / b) * 100 : undefined);
const f1 = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0).replace('.', ',')} %`;

/** Arrondi « humain » d'un prix cible (0,05 € sous 5 €, 0,5 € sous 50 €, 1 € sous 200 €, 5 € au-delà). */
export function niceTarget(v: number): number {
  const step = v < 5 ? 0.05 : v < 50 ? 0.5 : v < 200 ? 1 : 5;
  return Math.max(step, Math.floor(v / step) * step);
}

export function analyse(q: Quote): Analysis {
  const vsMonth = pct(q.price, q.avg30);
  const vsWeek = pct(q.price, q.avg7);
  const trend = q.change7;
  const spread = q.low ? pct(q.price, q.low) : undefined;
  const reasons: string[] = [];

  let verdict: Verdict = 'normal';
  if (vsMonth !== undefined) {
    if (vsMonth <= -5 && (vsWeek ?? 0) >= -1.5) verdict = 'window';
    else if (vsMonth <= -5) verdict = 'falling';
    else if (vsMonth >= 15) verdict = 'hot';
    else if ((trend ?? 0) <= -3 && (vsWeek ?? 0) >= 3) verdict = 'rebound';
  }

  let score = 50;
  if (vsMonth !== undefined) score -= vsMonth * 1.6;
  if (verdict === 'rebound') score += 8;
  if (verdict === 'window') score += 6;
  if (verdict === 'falling') score -= 10;
  if (vsMonth !== undefined && vsMonth > 15) score -= (vsMonth - 15) * 0.8;
  score = Math.round(Math.max(0, Math.min(100, score)));

  if (vsMonth !== undefined) reasons.push(vsMonth < 0 ? `${f1(vsMonth)} sous sa moyenne du mois` : vsMonth > 0 ? `${f1(vsMonth)} au-dessus de sa moyenne du mois` : 'Pile à sa moyenne du mois');
  if (vsWeek !== undefined && Math.abs(vsWeek) >= 1.5) reasons.push(vsWeek > 0 ? `Remonte depuis une semaine (${f1(vsWeek)} vs moyenne 7 j)` : `Continue de baisser (${f1(vsWeek)} vs moyenne 7 j)`);
  if (trend !== undefined && Math.abs(trend) >= 3) reasons.push(trend > 0 ? `Tendance du mois en hausse (${f1(trend)})` : `Tendance du mois en baisse (${f1(trend)})`);
  if (spread !== undefined && spread > 40 && q.low) {
    const gap = Math.round(((q.price - q.low) / q.price) * 100);
    reasons.push(`Des exemplaires sont proposés jusqu'à ${gap} % moins cher (souvent en moins bon état) : compare avant d'acheter`);
  }

  const refs = [q.price, q.avg7, q.avg30].filter((x): x is number => !!x);
  const target = niceTarget(Math.min(...refs) * 0.93);
  return { q, verdict, score, vsMonth, vsWeek, trend, spread, reasons, target };
}

/** Climat du marché : part des cartes sous leur moyenne du mois. */
export function climate(list: Analysis[]) {
  const withRef = list.filter((a) => a.vsMonth !== undefined);
  const below = withRef.filter((a) => a.vsMonth! < -2).length;
  const above = withRef.filter((a) => a.vsMonth! > 2).length;
  // Position de l'aiguille : part des cartes en baisse parmi celles qui ont bougé (0,5 si rien ne bouge).
  const share = below + above ? below / (below + above) : 0.5;
  const label = share >= 0.6 ? 'Marché acheteur' : share <= 0.4 ? 'Marché vendeur' : 'Marché équilibré';
  const text = share >= 0.6
    ? 'La majorité des cartes qui bougent se vendent sous leur moyenne du mois : les prix sont plutôt doux.'
    : share <= 0.4
      ? 'La plupart des cartes qui bougent sont au-dessus de leur moyenne du mois : les prix sont tendus.'
      : 'Autant de cartes en hausse qu\'en baisse : pas de mouvement d\'ensemble.';
  return { share, below, above, total: withRef.length, label, text };
}
