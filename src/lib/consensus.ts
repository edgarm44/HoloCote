// Cote retenue à partir des sources : Cardmarket d'abord (marché européen, en euros, c'est celui des joueurs français).
//  - deux relevés Cardmarket (TCGdex et pokemontcg.io) qui s'accordent à 50 % près : leur moyenne ;
//  - sinon la valeur TCGdex (elle suit la bonne variante de la carte ; pokemontcg.io mélange parfois 1re édition et illimitée) ;
//  - sans Cardmarket : TCGplayer converti en euros, signalé comme moins sûr (marché américain, prix plancher plus élevé).
// Même règle dans scripts/prices.mjs (relevé quotidien).

export interface Srcs { cm?: number; tp?: number; pcm?: number; ptp?: number }
export interface Consensus { value: number; n: number; uncertain: boolean }

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const median = (a: number[]) => { const v = [...a].sort((x, y) => x - y); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

export function consensusOf(s: Srcs, fx: number): Consensus | null {
  const { cm, pcm } = s;
  if (ok(cm) && ok(pcm)) {
    const r = Math.max(cm, pcm) / Math.min(cm, pcm);
    return r <= 1.5 ? { value: (cm + pcm) / 2, n: 2, uncertain: false } : { value: cm, n: 1, uncertain: r > 2.5 };
  }
  if (ok(cm)) return { value: cm, n: 1, uncertain: false };
  if (ok(pcm)) return { value: pcm, n: 1, uncertain: false };
  const us = [s.tp, s.ptp].filter(ok).map((x) => x * fx);
  return us.length ? { value: median(us), n: us.length, uncertain: true } : null;
}
