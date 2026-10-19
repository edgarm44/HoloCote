// Historique des cotes : relevé quotidien publié avec le site (data/history.json, mis à jour chaque matin
// par GitHub Actions) + relevés faits par ton navigateur quand tu consultes une carte.

import { BASE } from './ui';

export interface Point { day: number; price: number; ref?: string } // day = jours depuis le 1er janvier 2026 (UTC)
const EPOCH = Date.UTC(2026, 0, 1);
export const dayOf = (d = new Date()) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 864e5);
export const dateOf = (day: number) => new Date(EPOCH + day * 864e5);

interface History { v: number; updated: string; cards: Record<string, { n: string; p: [number, number][] }> }
let pub: Promise<History | null> | null = null;

/** Historique publié (null s'il n'existe pas encore). */
export function loadHistory(): Promise<History | null> {
  if (!pub) {
    pub = fetch(`${BASE}/data/history.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => (h && h.cards ? (h as History) : null))
      .catch(() => null);
  }
  return pub;
}

/* ---------- Relevés du navigateur ---------- */
const LOCAL = 'holocote.pricelog.v1';
type Local = Record<string, [number, number][]>;
function readLocal(): Local {
  try { const v = JSON.parse(localStorage.getItem(LOCAL) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** Note la cote du jour d'une carte consultée (une valeur par jour). */
export function recordPrice(key: string, price: number) {
  if (!(price > 0)) return;
  const all = readLocal();
  const day = dayOf();
  const list = (all[key] ?? []).filter(([d]) => d !== day);
  list.push([day, Math.round(price * 100) / 100]);
  all[key] = list.slice(-180);
  // On garde les 250 cartes consultées le plus récemment.
  const keys = Object.keys(all);
  if (keys.length > 250) {
    keys.sort((a, b) => (all[a].at(-1)?.[0] ?? 0) - (all[b].at(-1)?.[0] ?? 0)).slice(0, keys.length - 250).forEach((k) => delete all[k]);
  }
  try { localStorage.setItem(LOCAL, JSON.stringify(all)); } catch { /* rien */ }
}

/** Série complète d'une carte : historique publié + relevés du navigateur (le publié l'emporte le même jour). */
export async function seriesFor(id: string, lang: 'fr' | 'en'): Promise<{ points: Point[]; since?: number; published: boolean }> {
  const h = await loadHistory();
  const map = new Map<number, number>();
  for (const [d, p] of readLocal()[`${lang}:${id}`] ?? []) map.set(d, p);
  const pubPts = h?.cards[id]?.p ?? [];
  // L'historique publié suit la version la plus cotée (FR, sinon EN) : on l'utilise pour les deux langues.
  for (const [d, p] of pubPts) map.set(d, p);
  const points = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([day, price]) => ({ day, price }));
  return { points, since: points[0]?.day, published: pubPts.length > 0 };
}

export async function indexSeries(): Promise<Point[]> {
  const h = await loadHistory();
  return (h?.cards._index?.p ?? []).map(([day, price]) => ({ day, price }));
}

/* ---------- Graphique ---------- */
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};
const short = (day: number) => dateOf(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Courbe dans le temps. points : relevés réels (trait plein) ; refs : repères Cardmarket (pointillés).
 * L'axe horizontal est proportionnel aux dates.
 */
export function timeChart(points: Point[], refs: Point[], fmt: (v: number) => string, width = 720, height = 240): SVGSVGElement {
  const all = [...points, ...refs];
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'time-chart', role: 'img' }) as SVGSVGElement;
  if (!all.length) return svg;
  const padL = 8, padR = 8, padT = 22, padB = 26;
  const d0 = Math.min(...all.map((p) => p.day)), d1 = Math.max(...all.map((p) => p.day), d0 + 1);
  let lo = Math.min(...all.map((p) => p.price)), hi = Math.max(...all.map((p) => p.price));
  if (hi - lo < hi * 0.04) { lo *= 0.97; hi *= 1.03; }
  const x = (d: number) => padL + ((d - d0) / (d1 - d0)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (height - padT - padB);
  svg.setAttribute('aria-label', `Évolution de la cote du ${short(d0)} au ${short(d1)}, de ${fmt(lo)} à ${fmt(hi)}`);
  const defs = svgEl('defs', {});
  const gid = `tc${Math.random().toString(36).slice(2, 7)}`;
  const grad = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svgEl('stop', { offset: 0, 'stop-color': '#3ef0ff', 'stop-opacity': 0.35 }), svgEl('stop', { offset: 1, 'stop-color': '#3ef0ff', 'stop-opacity': 0 }));
  defs.append(grad);
  svg.append(defs);
  for (let i = 0; i <= 3; i++) {
    const gy = padT + (i / 3) * (height - padT - padB);
    svg.append(svgEl('line', { x1: padL, x2: width - padR, y1: gy, y2: gy, stroke: 'rgba(255,255,255,0.07)' }));
  }
  const line = (pts: Point[], dash: boolean) => {
    if (pts.length < 2) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ');
    if (!dash) svg.append(svgEl('path', { d: `${d} L${x(pts.at(-1)!.day)} ${height - padB} L${x(pts[0].day)} ${height - padB} Z`, fill: `url(#${gid})` }));
    svg.append(svgEl('path', { d, fill: 'none', stroke: dash ? '#8a7bff' : '#3ef0ff', 'stroke-width': dash ? 2 : 2.6, 'stroke-dasharray': dash ? '6 6' : '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  };
  // Repères reliés au premier relevé réel pour montrer d'où vient la cote.
  const sortedRefs = [...refs].sort((a, b) => a.day - b.day);
  line(points.length ? [...sortedRefs.filter((r) => r.day < points[0].day), points[0]] : sortedRefs, true);
  line(points, false);
  const dot = (p: Point, ref: boolean) => {
    const c = svgEl('circle', { cx: x(p.day), cy: y(p.price), r: ref ? 4 : points.length > 60 ? 0 : 3.2, fill: ref ? '#8a7bff' : '#3ef0ff', stroke: '#07060d', 'stroke-width': 1.5 });
    const t = svgEl('title', {});
    t.textContent = `${ref ? `${p.ref} · ` : ''}${short(p.day)} : ${fmt(p.price)}`;
    c.append(t);
    svg.append(c);
  };
  sortedRefs.forEach((p) => dot(p, true));
  points.forEach((p) => dot(p, false));
  const label = (txt: string, lx: number, ly: number, anchor: string) => {
    const t = svgEl('text', { x: lx, y: ly, 'text-anchor': anchor, fill: '#a9a4c9', 'font-size': 12 });
    t.textContent = txt;
    svg.append(t);
  };
  label(fmt(hi), padL, 14, 'start');
  label(fmt(lo), padL, height - padB - 6, 'start');
  label(short(d0), padL, height - 6, 'start');
  label(short(d1), width - padR, height - 6, 'end');
  return svg;
}
