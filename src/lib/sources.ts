// Cote multi-sources : on recoupe plusieurs sources publiques au lieu d'une seule.
//  - Cardmarket (marché européen, en euros) et TCGplayer (marché américain, en dollars) via TCGdex ;
//  - les mêmes places de marché via l'API pokemontcg.io (copie indépendante, mise à jour chaque jour) ;
//  - le relevé quotidien HoloDex (data/history.json), qui fait ce recoupement chaque matin.
// La cote HoloDex suit la règle de consensus.ts : Cardmarket d'abord (euros), TCGplayer converti seulement en secours.

import type { Card } from './tcgdex';
import { USD_TO_EUR } from './rarity';
import { loadHistory } from './history';
import { consensusOf } from './consensus';

export interface SourcePrice { id: 'cm' | 'tp' | 'pcm' | 'ptp'; name: string; via: string; value: number; unit: 'EUR' | 'USD'; eur: number; updated?: string; url?: string }
export interface MultiPrice { sources: SourcePrice[]; consensus?: number; n?: number; uncertain?: boolean; spread?: number; fx: number }

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
const median = (a: (number | undefined)[]) => { const v = a.filter((x): x is number => x !== undefined).sort((x, y) => x - y); if (!v.length) return undefined; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** Identifiant pokemontcg.io à partir d'un identifiant TCGdex (sv03.5-199 donne sv3pt5-199). */
const SPECIAL: Record<string, string> = { 'sv10.5b': 'zsv10pt5', 'sv10.5w': 'rsv10pt5', 'swsh4.5': 'swsh45', 'swsh3.5': 'swsh35', 'sm11.5': 'sm115', 'sm3.5': 'sm35', 'sm7.5': 'sm75' };
export function ptcgId(id: string): string | null {
  const i = id.lastIndexOf('-');
  if (i < 1) return null;
  const set = id.slice(0, i), local = id.slice(i + 1);
  const s = SPECIAL[set] ?? set.replace(/^([a-z]+)0*(\d+)\.5$/, '$1$2pt5').replace(/^([a-z]+)0+(\d)/, '$1$2');
  if (!/^[a-z0-9]+$/.test(s)) return null;
  return `${s}-${/^\d+$/.test(local) ? String(Number(local)) : local}`;
}

/* ---------- pokemontcg.io (navigateur, avec cache 24 h) ---------- */
interface Ptcg { cardmarket?: { url?: string; updatedAt?: string; prices?: Record<string, number> }; tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, Record<string, number>> } }
const PKEY = 'holocote.ptcg.v1';
function readCache(): Record<string, { t: number; d: Ptcg | null }> {
  try { const v = JSON.parse(localStorage.getItem(PKEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
async function fetchPtcg(id: string): Promise<Ptcg | null> {
  const pid = ptcgId(id);
  if (!pid) return null;
  const cache = readCache();
  const hit = cache[pid];
  if (hit && Date.now() - hit.t < 864e5) return hit.d;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(pid)}?select=id,cardmarket,tcgplayer`, { signal: ctl.signal });
    clearTimeout(timer);
    const d = r.ok ? ((await r.json()).data as Ptcg) : r.status === 404 ? null : undefined;
    if (d === undefined) return hit?.d ?? null;
    const keys = Object.keys(cache);
    if (keys.length > 300) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - 300).forEach((k) => delete cache[k]);
    cache[pid] = { t: Date.now(), d };
    try { localStorage.setItem(PKEY, JSON.stringify(cache)); } catch { /* rien */ }
    return d;
  } catch {
    return hit?.d ?? null; // source injoignable : on fait sans
  }
}

const TP_KEYS = ['holofoil', 'normal', 'unlimitedHolofoil', '1stEditionHolofoil', 'unlimited', '1stEdition'];
const tpValue = (prices: Record<string, unknown> | undefined, keys = TP_KEYS): number | undefined => {
  if (!prices) return undefined;
  for (const k of keys) { const v = prices[k] as Record<string, unknown> | undefined; if (v && typeof v === 'object') { const x = num(v.market) ?? num(v.mid); if (x) return x; } }
  return undefined;
};

export async function usdToEur(): Promise<number> {
  const h = await loadHistory();
  const fx = (h as unknown as { fx?: number } | null)?.fx;
  return typeof fx === 'number' && fx > 0.5 && fx < 1.5 ? fx : USD_TO_EUR;
}

/** Toutes les sources disponibles pour une carte, et leur médiane en euros. */
export async function multiPrice(card: Card): Promise<MultiPrice> {
  const fx = await usdToEur();
  const out: SourcePrice[] = [];
  const cm = card.pricing?.cardmarket as Record<string, unknown> | null | undefined;
  if (cm) {
    const v = median(['trend', 'avg', 'avg7', 'avg30'].map((f) => num(cm[f]))) ?? median(['trend-holo', 'avg-holo', 'avg7-holo', 'avg30-holo'].map((f) => num(cm[f])));
    if (v) out.push({ id: 'cm', name: 'Cardmarket', via: 'TCGdex', value: v, unit: 'EUR', eur: v, updated: cm.updated as string | undefined });
  }
  const tp = card.pricing?.tcgplayer as Record<string, unknown> | null | undefined;
  const tpv = tpValue(tp ?? undefined, ['holofoil', 'normal', 'unlimited-holofoil', '1st-edition-holofoil', 'unlimited', '1st-edition'].map((k) => k));
  if (tpv) out.push({ id: 'tp', name: 'TCGplayer', via: 'TCGdex', value: tpv, unit: 'USD', eur: tpv * fx, updated: tp?.updated as string | undefined });
  const p = await fetchPtcg(card.id);
  const pc = p?.cardmarket?.prices;
  if (pc) {
    const v = median([num(pc.trendPrice), num(pc.averageSellPrice), num(pc.avg7), num(pc.avg30)]);
    if (v) out.push({ id: 'pcm', name: 'Cardmarket', via: 'pokemontcg.io', value: v, unit: 'EUR', eur: v, updated: p?.cardmarket?.updatedAt?.replace(/\//g, '-'), url: p?.cardmarket?.url });
  }
  const pt = tpValue(p?.tcgplayer?.prices);
  if (pt) out.push({ id: 'ptp', name: 'TCGplayer', via: 'pokemontcg.io', value: pt, unit: 'USD', eur: pt * fx, updated: p?.tcgplayer?.updatedAt?.replace(/\//g, '-'), url: p?.tcgplayer?.url });
  const vals = out.map((s) => s.eur);
  const by = (id: SourcePrice['id']) => out.find((x) => x.id === id)?.value;
  const c = consensusOf({ cm: by('cm'), pcm: by('pcm'), tp: by('tp'), ptp: by('ptp') }, fx);
  const consensus = c?.value;
  const spread = vals.length >= 2 ? Math.max(...vals) / Math.min(...vals) : undefined;
  return { sources: out, consensus, n: c?.n, uncertain: c?.uncertain, spread, fx };
}

/** Liens de vérification directe sur les places de marché. */
export function marketLinks(name: string): { label: string; href: string }[] {
  const q = encodeURIComponent(name);
  return [
    { label: 'Cardmarket', href: `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${q}` },
    { label: 'TCGplayer', href: `https://www.tcgplayer.com/search/pokemon/product?q=${q}` },
    { label: 'eBay (ventes terminées)', href: `https://www.ebay.fr/sch/i.html?_nkw=${q}+pokemon&LH_Sold=1&LH_Complete=1` },
  ];
}

/** Cote multi-sources publiée par le relevé quotidien (si récente). */
export async function publishedConsensus(id: string): Promise<{ value: number; n: number; day: number } | null> {
  const h = await loadHistory();
  const c = (h?.cards[id] as unknown as { c?: [number, number, number] } | undefined)?.c; // [jour, cote, nombre de sources]
  return c && c[1] > 0 ? { day: c[0], value: c[1], n: c[2] } : null;
}
