// Relevé quotidien des cotes (lancé chaque jour par GitHub Actions, voir .github/workflows/prix.yml).
// Ajoute la cote du jour de chaque carte suivie à l'historique : node scripts/prices.mjs <fichier.json>
// Les cartes suivies sont celles du Marché (liste WATCHLIST), des rivaux du Classement et les cartes
// « chasse » des deux dernières extensions. Source : cotes Cardmarket publiées par TCGdex.

import fs from 'node:fs';

const API = process.env.TCGDEX_API || 'https://api.tcgdex.net/v2';
const out = process.argv[2] || 'history.json';
const MAX_POINTS = 1100; // environ 3 ans

const src = (f) => fs.readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8');
const watch = [...src('market.ts').split('export const WATCHLIST')[1].split('];')[0].matchAll(/'([\w.\-]+)'/g)].map((m) => m[1]);
const rivals = [...src('leaderboard.ts').matchAll(/\{ id: '([\w.\-]+-[\w]+)', cond:/g)].map((m) => m[1]);

async function get(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API + path);
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch { /* réessai */ }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
const median = (a) => { const v = a.filter((x) => x !== undefined).sort((x, y) => x - y); if (!v.length) return undefined; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** Même calcul que la fiche carte : médiane de la tendance, du prix moyen et des moyennes 7 et 30 jours. */
function price(card) {
  const cm = card?.pricing?.cardmarket;
  if (!cm) return undefined;
  const holoOnly = card.variants?.normal === false && card.variants?.holo === true;
  const pick = (holo) => median(['trend', 'avg', 'avg7', 'avg30'].map((f) => num(cm[holo ? `${f}-holo` : f])));
  return pick(false) ?? (holoOnly ? pick(true) : undefined);
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

const ids = [...new Set([...watch, ...rivals, ...(await newestChase())])];
let ok = 0;
let index = 0, indexN = 0;
const queue = [...ids];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    let card = await get(`/fr/cards/${encodeURIComponent(id)}`);
    let p = price(card);
    if (p === undefined) { const en = await get(`/en/cards/${encodeURIComponent(id)}`); const pe = price(en); if (pe !== undefined) { card = card ?? en; p = pe; } }
    if (p === undefined) continue;
    const entry = hist.cards[id] ?? { n: card?.name ?? id, p: [] };
    entry.n = card?.name ?? entry.n;
    entry.p = entry.p.filter(([d]) => d !== day);
    entry.p.push([day, Math.round(p * 100) / 100]);
    entry.p = entry.p.slice(-MAX_POINTS);
    hist.cards[id] = entry;
    if (watch.includes(id)) { index += p; indexN++; }
    ok++;
  }
}));
if (indexN) {
  const e = hist.cards._index ?? { n: 'Indice HoloCote (somme des cotes du Marché)', p: [] };
  e.p = [...e.p.filter(([d]) => d !== day), [day, Math.round(index)]].slice(-MAX_POINTS);
  hist.cards._index = e;
}
hist.updated = today.toISOString().slice(0, 10);
fs.writeFileSync(out, JSON.stringify(hist));
console.log(`Relevé du ${hist.updated} : ${ok}/${ids.length} cartes cotées.`);
if (!ok) process.exit(1);
