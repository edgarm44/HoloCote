// Recherche intelligente : tolère les fautes de frappe et d'orthographe
// (« Dracofeu » trouve « Dracaufeu », « pikatchu » trouve « Pikachu »).
// On compare la saisie à tous les noms de cartes de l'index TCGdex :
// orthographe exacte, début de nom, distance d'édition et une forme « phonétique » simplifiée.

import { loadIndex, coreName, normalize, type IndexEntry } from './cardindex';
import { searchCards, type CardBrief, type Lang } from './tcgdex';

export interface NameGroup {
  key: string;          // nom normalisé sans suffixe (ex, V, VMAX…)
  label: string;        // nom affiché (le plus court des variantes)
  cards: IndexEntry[];
  score: number;
}

/** Forme phonétique française approximative : « dracofeu » et « dracaufeu » donnent la même chose. */
export function phonetic(s: string): string {
  return normalize(s)
    .replace(/eau|au/g, 'o')
    .replace(/ph/g, 'f')
    .replace(/qu|ck|c(?=[aou])|k/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[yi]/g, 'i')
    .replace(/z/g, 's')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/(tch|ch)/g, 'ch');
}

interface Groups { list: { key: string; phon: string; label: string; cards: IndexEntry[] }[] }
const groupsCache = new Map<Lang, Promise<Groups>>();

function groups(lang: Lang): Promise<Groups> {
  if (!groupsCache.has(lang)) {
    const p = loadIndex(lang).then(({ cards }) => {
      const map = new Map<string, { key: string; phon: string; label: string; cards: IndexEntry[] }>();
      for (const c of cards) {
        const key = c.core || normalize(c.name);
        if (!key) continue;
        let g = map.get(key);
        if (!g) { g = { key, phon: phonetic(key), label: c.name, cards: [] }; map.set(key, g); }
        g.cards.push(c);
        if (c.name.length < g.label.length) g.label = c.name;
      }
      return { list: [...map.values()] };
    });
    p.catch(() => groupsCache.delete(lang));
    groupsCache.set(lang, p);
  }
  return groupsCache.get(lang)!;
}

export function preloadSearch(lang: Lang) {
  groups(lang).catch(() => {});
}

/** Ressemblance par distance d'édition (0 à 1), transpositions comprises. */
function lev(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return 1 - d[m][n] / Math.max(m, n);
}
const similarity = lev;

/** Note de ressemblance entre la saisie et un nom (0 à 1). */
function score(q: string, qp: string, key: string, phon: string): number {
  if (key === q) return 1;
  if (key.startsWith(q)) return 0.96 - Math.min(0.1, (key.length - q.length) * 0.004);
  if (phon === qp) return 0.94;
  if (q.length >= 3 && key.includes(q)) return 0.86;
  let s = Math.max(similarity(q, key), similarity(qp, phon) - 0.02);
  // La saisie contient un nom plus court (« dracofeu » contient « draco ») : bonus modéré seulement.
  if (key.length >= 4 && q.includes(key)) s = Math.max(s, 0.2 + 0.7 * (key.length / q.length));
  // Saisie en cours : on compare aussi au début du nom.
  if (q.length >= 3 && key.length > q.length) {
    s = Math.max(s, similarity(q, key.slice(0, q.length)) - 0.06, similarity(qp, phon.slice(0, qp.length)) - 0.08);
  }
  return s;
}

/** Noms les plus proches de la saisie. */
export async function suggestNames(query: string, lang: Lang, limit = 8): Promise<NameGroup[]> {
  const q = coreName(query) || normalize(query);
  if (q.length < 2) return [];
  const qp = phonetic(q);
  const { list } = await groups(lang);
  const out: NameGroup[] = [];
  for (const g of list) {
    const sc = score(q, qp, g.key, g.phon);
    if (sc >= 0.62) out.push({ key: g.key, label: g.label, cards: g.cards, score: sc });
  }
  // À score égal, on privilégie les noms les plus fréquents (Pokémon populaires).
  out.sort((a, b) => b.score - a.score || b.cards.length - a.cards.length);
  return out.slice(0, limit);
}

export interface SmartResult {
  cards: CardBrief[];
  didYouMean?: string;   // nom corrigé quand la saisie contenait une faute
  names: NameGroup[];
  fallback: boolean;     // index indisponible : recherche classique utilisée
}

/** Recherche complète : cartes correspondant aux meilleurs noms trouvés. */
export async function smartSearch(query: string, lang: Lang, max = 72): Promise<SmartResult> {
  try {
    const names = await suggestNames(query, lang, 12);
    if (!names.length) return { cards: [], names, fallback: false };
    const top = names[0].score;
    const chosen = names.filter((n) => n.score >= Math.max(0.62, top - (top >= 0.9 ? 0.04 : 0.12))).slice(0, 4);
    const q = coreName(query) || normalize(query);
    const exactish = chosen.some((n) => n.key === q || n.key.startsWith(q));
    const cards = chosen
      .flatMap((n) => n.cards)
      .slice()
      .reverse() // l'index va du plus ancien au plus récent : on montre les plus récentes d'abord
      .slice(0, max);
    return { cards, names, didYouMean: exactish ? undefined : chosen[0].label, fallback: false };
  } catch {
    const cards = await searchCards(query, lang, max).catch(() => []);
    return { cards, names: [], fallback: true };
  }
}

/* Recherches récentes (dans le navigateur) */
const RECENT_KEY = 'holocote.recent.v1';

export function recentSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  const list = [t, ...recentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* rien */ }
}

export function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* rien */ }
}
