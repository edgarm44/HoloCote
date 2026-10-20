// Relevé quotidien des cotes (lancé chaque jour par GitHub Actions, voir .github/workflows/prix.yml).
// Ajoute la cote du jour de chaque carte suivie à l'historique : node scripts/prices.mjs <fichier.json>
// Les cartes suivies sont celles du Marché (liste WATCHLIST), des rivaux du Classement et les cartes
// « chasse » des deux dernières extensions.
// Sources recoupées : Cardmarket et TCGplayer via TCGdex, Cardmarket et TCGplayer via pokemontcg.io,
// taux de change du jour de la Banque centrale européenne (frankfurter.app). La cote retenue suit src/lib/consensus.ts
// (Cardmarket d'abord, TCGplayer en secours), en euros.

import fs from 'node:fs';

const API = process.env.TCGDEX_API || 'https://api.tcgdex.net/v2';
const PTCG = process.env.PTCG_API || 'https://api.pokemontcg.io/v2';
const FX_API = process.env.FX_API || 'https://api.frankfurter.app/latest?from=USD&to=EUR';
const out = process.argv[2] || 'history.json';
const MAX_POINTS = 1100; // environ 3 ans

const src = (f) => fs.readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8');
const watch = [...src('market.ts').split('export const WATCHLIST')[1].split('];')[0].matchAll(/'([\w.\-]+)'/g)].map((m) => m[1]);
const rivals = [...src('leaderboard.ts').matchAll(/\{ id: '([\w.\-]+-[\w]+)', cond:/g)].map((m) => m[1]);

async function get(path, base = API) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(base + path);
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch { /* réessai */ }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
/** Même règle que src/lib/consensus.ts : Cardmarket d'abord, TCGplayer seulement en secours. */
function consensusOf(s, fx) {
  const cm = num(s.cm), pcm = num(s.pcm);
  if (cm && pcm) { const r = Math.max(cm, pcm) / Math.min(cm, pcm); return r <= 1.5 ? { value: (cm + pcm) / 2, n: 2, uncertain: false } : { value: cm, n: 1, uncertain: r > 2.5 }; }
  if (cm || pcm) return { value: cm ?? pcm, n: 1, uncertain: false };
  const us = [num(s.tp), num(s.ptp)].filter((x) => x !== undefined).map((x) => x * fx);
  return us.length ? { value: median(us), n: us.length, uncertain: true } : null;
}
const median = (a) => { const v = a.filter((x) => x !== undefined).sort((x, y) => x - y); if (!v.length) return undefined; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** Même calcul que la fiche carte : médiane de la tendance, du prix moyen et des moyennes 7 et 30 jours. */
function price(card) {
  const cm = card?.pricing?.cardmarket;
  if (!cm) return undefined;
  const holoOnly = card.variants?.normal === false && card.variants?.holo === true;
  const pick = (holo) => median(['trend', 'avg', 'avg7', 'avg30'].map((f) => num(cm[holo ? `${f}-holo` : f])));
  return pick(false) ?? (holoOnly ? pick(true) : undefined);
}
const tpVal = (prices, keys) => { if (!prices) return undefined; for (const k of keys) { const v = prices[k]; if (v && typeof v === 'object') { const x = num(v.marketPrice ?? v.market) ?? num(v.midPrice ?? v.mid); if (x) return x; } } return undefined; };
const TCGDEX_TP = ['holofoil', 'normal', 'unlimited-holofoil', '1st-edition-holofoil', 'unlimited', '1st-edition'];
const PTCG_TP = ['holofoil', 'normal', 'unlimitedHolofoil', '1stEditionHolofoil', 'unlimited', '1stEdition'];

/** Identifiant pokemontcg.io (même règle que src/lib/sources.ts). */
const SPECIAL = { 'sv10.5b': 'zsv10pt5', 'sv10.5w': 'rsv10pt5', 'swsh4.5': 'swsh45', 'swsh3.5': 'swsh35', 'sm11.5': 'sm115', 'sm3.5': 'sm35', 'sm7.5': 'sm75' };
function ptcgId(id) {
  const i = id.lastIndexOf('-');
  if (i < 1) return null;
  const set = id.slice(0, i), local = id.slice(i + 1);
  const s = SPECIAL[set] ?? set.replace(/^([a-z]+)0*(\d+)\.5$/, '$1$2pt5').replace(/^([a-z]+)0+(\d)/, '$1$2');
  return /^[a-z0-9]+$/.test(s) ? `${s}-${/^\d+$/.test(local) ? String(Number(local)) : local}` : null;
}
async function ptcgPrices(ids) {
  const out = new Map();
  const pids = ids.map((id) => [id, ptcgId(id)]).filter(([, p]) => p);
  for (let i = 0; i < pids.length; i += 30) {
    const chunk = pids.slice(i, i + 30);
    const q = encodeURIComponent(chunk.map(([, p]) => `id:"${p}"`).join(' OR '));
    const d = await get(`/cards?q=${q}&pageSize=250&select=id,cardmarket,tcgplayer`, PTCG);
    for (const c of d?.data ?? []) {
      const src = chunk.find(([, p]) => p === c.id);
      if (src) out.set(src[0], c);
    }
    await new Promise((res) => setTimeout(res, Number(process.env.PTCG_DELAY ?? 2500))); // sans clé : 30 requêtes par minute au plus
  }
  return out;
}

async function newestChase() {
  const sets = (await get('/fr/sets')) ?? [];
  const recent = sets.filter((s) => (s.cardCount?.official ?? 0) >= 50 && (s.cardCount?.total ?? 0) > (s.cardCount?.official ?? 0)).slice(-2);
  const ids = [];
  for (const s of recent) {
    const d = await get(`/fr/sets/${encodeURIComponent(s.id)}`);
    const official = d?.cardCount?.official ?? s.cardCount?.official ?? 0;
    ids.push(...(d?.cards ?? []).filter((c) => /^\d+$/.test(c.localId) && Number(c.localId) > official).slice(-14).map((c) => c.id));
  }
  return ids;
}

const EPOCH = Date.UTC(2026, 0, 1);
const today = new Date();
const day = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - EPOCH) / 864e5);

let hist = { v: 1, epoch: '2026-01-01', updated: '', cards: {} };
try { const h = JSON.parse(fs.readFileSync(out, 'utf8')); if (h && h.cards) hist = h; } catch { /* premier relevé */ }

const chaseIds = await newestChase();
const ids = [...new Set([...watch, ...rivals, ...chaseIds])];
const CHASE_RARITY = /illustration sp|special illustration|hyper|secr|gold|dor|ultra rare|double rare/i;
let fx = 0.92;
try { const f = await fetch(FX_API).then((r) => r.json()); if (f?.rates?.EUR > 0.5 && f.rates.EUR < 1.5) fx = f.rates.EUR; } catch { /* taux par défaut */ }
const ptcg = await ptcgPrices(ids).catch(() => new Map());
let ok = 0, multi = 0;
let index = 0, indexN = 0;
const queue = [...ids];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    let card = await get(`/fr/cards/${encodeURIComponent(id)}`);
    let cmv = price(card);
    let tpCard = card;
    let lang = card ? 'fr' : 'en';
    if (cmv === undefined) { const en = await get(`/en/cards/${encodeURIComponent(id)}`); const pe = price(en); if (pe !== undefined) { if (!card) { card = en; lang = 'en'; } cmv = pe; tpCard = en; } }
    const tpv = tpVal(tpCard?.pricing?.tcgplayer, TCGDEX_TP);
    const pc = ptcg.get(id);
    const pcm = median([num(pc?.cardmarket?.prices?.trendPrice), num(pc?.cardmarket?.prices?.averageSellPrice), num(pc?.cardmarket?.prices?.avg7), num(pc?.cardmarket?.prices?.avg30)]);
    const ptp = tpVal(pc?.tcgplayer?.prices, PTCG_TP);
    const src = { cm: cmv, tp: tpv, pcm, ptp };
    const cons = consensusOf(src, fx);
    if (!cons) continue;
    const p = cons.value;
    const eur = [cmv, tpv && tpv * fx, pcm, ptp && ptp * fx].filter((x) => x !== undefined && x > 0); // toutes les sources, pour l'écart affiché
    const entry = hist.cards[id] ?? { n: card?.name ?? id, p: [] };
    entry.n = card?.name ?? entry.n;
    entry.p = entry.p.filter(([d]) => d !== day);
    entry.p.push([day, Math.round(p * 100) / 100]);
    entry.p = entry.p.slice(-MAX_POINTS);
    entry.c = [day, Math.round(p * 100) / 100, cons.n];
    entry.s = Object.fromEntries(Object.entries(src).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Math.round(v * 100) / 100]));
    // Fiche pour le Marché et la Recherche (évite des centaines de requêtes côté visiteur).
    const cm = (lang === 'fr' ? card : tpCard)?.pricing?.cardmarket ?? card?.pricing?.cardmarket;
    const holoOnly = card?.variants?.normal === false && card?.variants?.holo === true && !num(cm?.avg30) && !num(cm?.avg7);
    const k = (f) => num(cm?.[holoOnly ? `${f}-holo` : f]);
    const refs = [k('trend'), k('avg'), k('avg7'), k('avg30')].filter((x) => x !== undefined);
    const group = watch.includes(id) ? 'legend' : chaseIds.includes(id) && /pok[eé]mon/i.test(card?.category ?? 'Pokemon') && CHASE_RARITY.test(card?.rarity ?? '') ? 'new' : 'other';
    entry.m = {
      l: lang, i: card?.image, s: card?.set?.name, r: card?.rarity, g: group,
      a7: k('avg7'), a30: k('avg30'), lo: k('low'), up: cm?.updated,
      u: refs.length < 2 || Math.max(...refs) / Math.min(...refs) > 3 || cons.uncertain || undefined,
    };
    hist.cards[id] = entry;
    if (watch.includes(id)) { index += p; indexN++; }
    if (cons.n >= 2) multi++;
    ok++;
  }
}));
hist.fx = fx;
// Anciens relevés : on recalcule la cote du dernier jour avec la règle actuelle (idempotent).
for (const [id, e] of Object.entries(hist.cards)) {
  if (id.startsWith('_') || !e.s || !e.c || e.c[0] === day) continue;
  const r = consensusOf(e.s, hist.fx);
  if (!r) continue;
  const v = Math.round(r.value * 100) / 100;
  e.c = [e.c[0], v, r.n];
  const last = e.p[e.p.length - 1];
  if (last && last[0] === e.c[0]) last[1] = v;
}
if (indexN) {
  const e = hist.cards._index ?? { n: 'Indice HoloCote (somme des cotes du Marché)', p: [] };
  e.p = [...e.p.filter(([d]) => d !== day), [day, Math.round(index)]].slice(-MAX_POINTS);
  hist.cards._index = e;
}
hist.updated = today.toISOString().slice(0, 10);
fs.writeFileSync(out, JSON.stringify(hist));
console.log(`Relevé du ${hist.updated} : ${ok}/${ids.length} cartes cotées, ${multi} recoupées par au moins 2 sources (1 USD = ${fx} EUR).`);
if (!ok) process.exit(1);
