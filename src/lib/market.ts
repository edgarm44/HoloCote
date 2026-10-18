// « Marché » HoloCote : cours des cartes façon bourse.
// Source : cotes Cardmarket fournies par TCGdex. TCGdex ne publie pas d'historique
// jour par jour : on dispose de repères (moyenne 30 jours, moyenne 7 jours, cours actuel).
// La moyenne de la veille n'est pas utilisée : sur données réelles elle varie du simple
// au triple d'un jour à l'autre (une seule vente suffit).

import { getCard, listSets, priceFor, clearApiCache, type Card, type CardBrief, type Lang } from './tcgdex';

export interface Quote {
  id: string;
  lang: Lang;
  name: string;
  image?: string;
  setName?: string;
  rarity?: string;
  price: number;          // cours HoloCote (même calcul que la fiche carte)
  avg30?: number;
  avg7?: number;
  low?: number;           // plus bas prix proposé à la vente (Cardmarket)
  change7?: number;       // variation : moyenne 7 j comparée à la moyenne 30 j (en %)
  points: number[];       // repères pour le mini-graphique, du plus ancien au plus récent
  updated?: string;
  group: 'legend' | 'new';
}

/** Cartes « légendaires » suivies en permanence (identifiants TCGdex). Les absentes sont ignorées. */
export const WATCHLIST: string[] = [
  // Classiques (identifiants vérifiés dans la base TCGdex du 3 octobre 2026)
  'base1-4',        // Dracaufeu — Set de base
  'base1-2',        // Tortank — Set de base
  'base1-15',       // Florizarre — Set de base
  'base1-10',       // Mewtwo — Set de base
  'swsh7-215',      // Noctali VMAX — Évolution Céleste
  'swsh4-188',      // Pikachu VMAX — Voltage Éclatant
  // Écarlate et Violet
  'sv03-223',       // Dracaufeu-ex — Flammes Obsidiennes
  'sv03.5-199',     // Dracaufeu-ex — 151
  'sv03.5-200',     // Tortank-ex — 151
  'sv03.5-198',     // Florizarre-ex — 151
  'sv03.5-205',     // Mew-ex — 151
  'sv04.5-234',     // Dracaufeu-ex — Destinées de Paldea
  'sv08-238',       // Pikachu-ex — Étincelles Déferlantes
  'sv08.5-161',     // Noctali-ex — Évolutions Prismatiques
  'sv09-185',       // Zoroark-ex de N — Aventures Ensemble
  'sv10-231',       // Mewtwo-ex de la Team Rocket — Rivalités Destinées
  'sv10.5b-166',    // Zekrom-ex — Foudre Noire
  'sv10.5w-166',    // Reshiram-ex — Flamme Blanche
  // Méga-Évolution (2025-2026)
  'me01-188',       // Méga-Lucario-ex (Mega Hyper Rare) — Méga-Évolution
  'me01-187',       // Méga-Gardevoir-ex (Mega Hyper Rare) — Méga-Évolution
  'me02-130',       // Méga-Dracaufeu X-ex (Mega Hyper Rare) — Flammes Fantasmagoriques
  'me02-125',       // Méga-Dracaufeu X-ex — Flammes Fantasmagoriques
  'me02.5-277',     // Pikachu-ex — Héros Transcendants
  'me03-124',       // Méga-Zygarde-ex (Mega Hyper Rare) — Équilibre Parfait
  'me04-122',       // Méga-Amphinobi-ex (Mega Hyper Rare) — Chaos Ascendant
  'me05-120',       // Méga-Darkrai-ex (Mega Hyper Rare) — Nuit Noire
  '30th-150',       // Pikachu-ex — 30ᵉ Anniversaire
  '30th-152',       // Mew-ex — 30ᵉ Anniversaire
  // Ajouts du 18 octobre 2026 (identifiants vérifiés dans la base TCGdex du 3 octobre 2026)
  'base1-58',       // Pikachu — Set de base
  'base1-16',       // Électhor — Set de base
  'base1-1',        // Alakazam — Set de base
  'swsh7-218',      // Rayquaza VMAX (alternative) — Évolution Céleste
  'swsh7-212',      // Nymphali VMAX (alternative) — Évolution Céleste
  'swsh8-269',      // Mew VMAX (alternative) — Poing de Fusion
  'swsh8-271',      // Ectoplasma VMAX (alternative) — Poing de Fusion
  'swsh9-174',      // Dracaufeu VSTAR (secrète) — Stars Étincelantes
  'swsh11-186',     // Giratina V (alternative) — Origine Perdue
  'swsh12-186',     // Lugia V (alternative) — Tempête Argentée
  'sv01-245',       // Gardevoir-ex (illustration spéciale) — Écarlate et Violet
  'sv01-254',       // Koraidon-ex (hyper rare) — Écarlate et Violet
  'sv02-256',       // Miascarade-ex (illustration spéciale) — Évolutions à Paldea
  'sv04.5-232',     // Mew-ex (illustration spéciale) — Destinées de Paldea
  'sv04.5-233',     // Gardevoir-ex (illustration spéciale) — Destinées de Paldea
  'sv06-214',       // Amphinobi-ex (illustration spéciale) — Mascarade Crépusculaire
  'sv06-216',       // Ursaking Lune Vermeille-ex (illustration spéciale) — Mascarade Crépusculaire
  'sv06.5-093',     // Pêchaminus-ex (illustration spéciale) — Fable Nébuleuse
  'sv08.5-167',     // Évoli-ex (illustration spéciale) — Évolutions Prismatiques
  'sv08.5-156',     // Nymphali-ex (illustration spéciale) — Évolutions Prismatiques
  'sv08.5-155',     // Mentali-ex (illustration spéciale) — Évolutions Prismatiques
  'sv08.5-179',     // Pikachu-ex (hyper rare) — Évolutions Prismatiques
  'me01-179',       // Méga-Lucario-ex (illustration spéciale) — Méga-Évolution
  'me01-177',       // Méga-Florizarre-ex (illustration spéciale) — Méga-Évolution
  'me02.5-294',     // Méga-Dracaufeu Y-ex (Mega Hyper Rare) — Héros Transcendants
  'me02.5-284',     // Méga-Ectoplasma-ex (illustration spéciale) — Héros Transcendants
  'me03-121',       // Miaouss-ex (illustration spéciale) — Équilibre Parfait
  'me04-116',       // Méga-Amphinobi-ex (illustration spéciale) — Chaos Ascendant
  'me05-116',       // Méga-Darkrai-ex (illustration spéciale) — Nuit Noire
  '30th-158',       // Mew-ex — 30ᵉ Anniversaire
  '30th-157',       // Mewtwo-ex — 30ᵉ Anniversaire
  '30th-154',       // Ectoplasma-ex — 30ᵉ Anniversaire
];

/** Époque d'une carte, d'après le préfixe de son identifiant (filtres du Marché). */
export type Era = 'classic' | 'swsh' | 'sv' | 'mega';
export const ERAS: { key: Era; label: string }[] = [
  { key: 'classic', label: 'Classiques' },
  { key: 'swsh', label: 'Épée et Bouclier' },
  { key: 'sv', label: 'Écarlate et Violet' },
  { key: 'mega', label: 'Méga-Évolution' },
];
export function eraOf(id: string): Era {
  if (/^(me\d|30th)/.test(id)) return 'mega';
  if (/^sv/.test(id)) return 'sv';
  if (/^swsh/.test(id)) return 'swsh';
  return 'classic';
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
const pct = (a?: number, b?: number) => (a && b ? ((a - b) / b) * 100 : undefined);

export function toQuote(card: Card, lang: Lang, group: Quote['group']): Quote | null {
  const cm = card.pricing?.cardmarket as Record<string, unknown> | null | undefined;
  const p = priceFor(card, 'normal');
  if (!cm || !p || p.source !== 'Cardmarket') return null;
  // Même champs que priceFor : version normale, ou « -holo » pour une carte uniquement holo sans cote normale.
  const holoOnly = card.variants?.normal === false && card.variants?.holo === true && !num(cm.avg30) && !num(cm.avg7);
  const k = (f: string) => num(cm[holoOnly ? `${f}-holo` : f]);
  const avg30 = k('avg30'), avg7 = k('avg7');
  const points = [avg30, avg7, p.value].filter((x): x is number => x !== undefined);
  return {
    id: card.id,
    lang,
    name: card.name,
    image: card.image,
    setName: card.set?.name,
    rarity: card.rarity,
    price: p.value,
    avg30, avg7,
    low: k('low'),
    change7: pct(avg7, avg30),
    points: points.length >= 2 ? points : [p.value, p.value],
    updated: p.updated,
    group,
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

async function cardAnyLang(id: string): Promise<{ card: Card; lang: Lang } | null> {
  for (const lang of ['fr', 'en'] as Lang[]) {
    const card = await getCard(id, lang).catch(() => null);
    if (card?.pricing?.cardmarket) return { card, lang };
  }
  return null;
}

interface SetDetail { id: string; name: string; cardCount?: { official?: number }; cards?: CardBrief[] }

/** Cartes « chasse » (numéro au-delà du total officiel) des deux dernières extensions. */
async function newestChase(max = 16): Promise<string[]> {
  const sets = await listSets('fr').catch(() => []);
  // Les deux extensions les plus récentes qui ont des cartes « chasse » (total > officiel).
  // On écarte les promos et les petites collections (moins de 50 cartes officielles).
  const recent = sets
    .filter((s) => (s.cardCount?.official ?? 0) >= 50 && (s.cardCount?.total ?? 0) > (s.cardCount?.official ?? 0))
    .slice(-2)
    .reverse();
  const ids: string[] = [];
  for (const s of recent) {
    const d: SetDetail | null = await fetch(`https://api.tcgdex.net/v2/fr/sets/${encodeURIComponent(s.id)}`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const official = d?.cardCount?.official ?? s.cardCount?.official ?? 0;
    const chase = (d?.cards ?? []).filter((c) => /^\d+$/.test(c.localId) && Number(c.localId) > official);
    // Les cartes les plus rares sont en fin de liste : on en garde les 14 dernières.
    ids.push(...chase.slice(-14).map((c) => c.id));
  }
  return ids.slice(0, max * 2);
}

/** Raretés « chasse » : illustrations spéciales, hyper rares, méga hyper rares, secrètes, dorées. */
const CHASE_RARITY = /illustration sp|special illustration|hyper|secr|gold|dor|ultra rare|double rare/i;

export interface Market {
  quotes: Quote[];
  index?: { value: number; change7?: number };
  loadedAt: number;
}

const CACHE_KEY = 'holocote.market.v4';
const TTL = 30 * 60 * 1000;

function readCache(): Market | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Market;
    return Date.now() - m.loadedAt < TTL && Array.isArray(m.quotes) ? m : null;
  } catch {
    return null;
  }
}

/**
 * Indice HoloCote : base 100 = valeur moyenne des cartes suivies sur 30 jours.
 * Indice = somme des cours actuels / somme des moyennes 30 jours x 100.
 */
function computeIndex(quotes: Quote[]): Market['index'] {
  const withHist = quotes.filter((q) => q.avg30);
  if (!withHist.length) return undefined;
  const sum = (f: (q: Quote) => number | undefined) => withHist.reduce((s, q) => s + (f(q) ?? q.price), 0);
  const s30 = sum((q) => q.avg30), s7 = sum((q) => q.avg7), now = sum((q) => q.price);
  return { value: (now / s30) * 100, change7: pct(s7, s30) };
}

let inflight: Promise<Market> | null = null;

export function loadMarket(force = false): Promise<Market> {
  if (force) {
    try { sessionStorage.removeItem(CACHE_KEY); } catch { /* rien */ }
    clearApiCache();
  }
  const cached = force ? null : readCache();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    const legends = await pool(WATCHLIST, 6, async (id) => {
      const r = await cardAnyLang(id);
      return r ? toQuote(r.card, r.lang, 'legend') : null;
    });
    const newIds = (await newestChase()).filter((id) => !WATCHLIST.includes(id));
    const fresh = (await pool(newIds, 6, async (id) => {
      const card = await getCard(id, 'fr').catch(() => null);
      // On garde les Pokémon aux raretés les plus recherchées (pas les cartes Dresseur ou Énergie).
      if (!card || !/pok[eé]mon/i.test(card.category ?? 'Pokemon') || !CHASE_RARITY.test(card.rarity ?? '')) return null;
      return toQuote(card, 'fr', 'new');
    })).filter(Boolean).slice(0, 16);
    const quotes = [...legends, ...fresh].filter((q): q is Quote => !!q);
    const market: Market = { quotes, index: computeIndex(quotes), loadedAt: Date.now() };
    if (quotes.length) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(market)); } catch { /* rien */ }
    }
    return market;
  })().finally(() => { inflight = null; });
  return inflight;
}

export function formatChange(v?: number): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0).replace('.', ',')} %`;
}

export const changeClass = (v?: number) => (v === undefined ? 'flat' : v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'flat');

/** Mini-graphique SVG (ligne + aire), couleur selon la tendance. */
export function sparkline(points: number[], width = 120, height = 36): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('spark');
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || max * 0.05 || 1;
  const pad = 3;
  const xy = points.map((p, i) => [
    pad + (i / (points.length - 1)) * (width - pad * 2),
    pad + (1 - (p - min) / span) * (height - pad * 2),
  ]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const trend = points[points.length - 1] - points[0];
  const cls = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', `${d} L${xy[xy.length - 1][0].toFixed(1)},${height} L${xy[0][0].toFixed(1)},${height} Z`);
  area.setAttribute('class', `spark-area ${cls}`);
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', d);
  line.setAttribute('class', `spark-line ${cls}`);
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', xy[xy.length - 1][0].toFixed(1));
  dot.setAttribute('cy', xy[xy.length - 1][1].toFixed(1));
  dot.setAttribute('r', '2.5');
  dot.setAttribute('class', `spark-dot ${cls}`);
  svg.append(area, line, dot);
  return svg;
}

/** Bandeau défilant façon cotations boursières (contenu doublé pour une boucle sans à-coup). */
export function ticker(quotes: Quote[], href: (q: Quote) => string, fmt: (v: number) => string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ticker';
  wrap.setAttribute('aria-label', 'Cours des cartes');
  const track = document.createElement('div');
  track.className = 'ticker-track';
  const items = (hidden: boolean) => quotes.map((q) => {
    const a = document.createElement('a');
    a.href = href(q);
    if (hidden) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
    const n = document.createElement('span'); n.className = 'tk-name'; n.textContent = q.name;
    const p = document.createElement('span'); p.className = 'tk-price'; p.textContent = fmt(q.price);
    const c = document.createElement('span'); c.className = `tk-chg ${changeClass(q.change7)}`;
    c.textContent = `${q.change7 === undefined ? '' : q.change7 >= 0 ? '▲ ' : '▼ '}${formatChange(q.change7)}`;
    a.append(n, p, c);
    return a;
  });
  track.append(...items(false), ...items(true));
  // Vitesse constante quel que soit le nombre de cartes.
  track.style.animationDuration = `${Math.max(20, quotes.length * 4)}s`;
  wrap.append(track);
  return wrap;
}

/**
 * Grand graphique (aire + courbe lissée + repères chiffrés).
 * `labels` décrit chaque point (ex. « Moy. 30 j »), `fmt` met en forme les valeurs.
 */
export function bigChart(points: number[], labels: string[], fmt: (v: number) => string, width = 720, height = 260): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('big-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', labels.map((l, i) => `${l} : ${fmt(points[i])}`).join(', '));
  const padX = 48, padTop = 46, padBottom = 40;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || Math.max(1, max * 0.04);
  const lo = min - span * 0.35, hi = max + span * 0.35;
  const X = (i: number) => padX + (i / Math.max(1, points.length - 1)) * (width - padX * 2);
  const Y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * (height - padTop - padBottom);
  const trend = points[points.length - 1] - points[0];
  const cls = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  const id = `g${Math.random().toString(36).slice(2, 7)}`;

  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="bc-stop-a ${cls}"/><stop offset="1" class="bc-stop-b"/></linearGradient>`;
  svg.append(defs);

  for (let k = 0; k <= 3; k++) {
    const y = padTop + (k / 3) * (height - padTop - padBottom);
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', String(padX)); l.setAttribute('x2', String(width - padX));
    l.setAttribute('y1', y.toFixed(1)); l.setAttribute('y2', y.toFixed(1));
    l.setAttribute('class', 'bc-grid');
    svg.append(l);
  }
  // Courbe lissée (Catmull-Rom -> Bézier).
  const pts = points.map((v, i) => [X(i), Y(v)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', `${d} L${pts[pts.length - 1][0]},${height - padBottom} L${pts[0][0]},${height - padBottom} Z`);
  area.setAttribute('fill', `url(#${id})`);
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', d);
  line.setAttribute('class', `bc-line ${cls}`);
  svg.append(area, line);

  pts.forEach(([x, y], i) => {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y)); dot.setAttribute('r', i === pts.length - 1 ? '6' : '4');
    dot.setAttribute('class', `bc-dot ${cls}${i === pts.length - 1 ? ' last' : ''}`);
    const val = document.createElementNS(ns, 'text');
    val.setAttribute('x', String(x)); val.setAttribute('y', String(y - 14));
    val.setAttribute('class', 'bc-val');
    val.setAttribute('text-anchor', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle');
    val.textContent = fmt(points[i]);
    const lab = document.createElementNS(ns, 'text');
    lab.setAttribute('x', String(x)); lab.setAttribute('y', String(height - 12));
    lab.setAttribute('class', 'bc-lab');
    lab.setAttribute('text-anchor', i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle');
    lab.textContent = labels[i] ?? '';
    svg.append(dot, val, lab);
  });
  return svg;
}
