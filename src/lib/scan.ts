// Scanner gratuit, entièrement dans le navigateur :
// 1. on isole la carte (cadre de visée de la caméra, ou détection automatique sur une photo),
// 2. on lit le nom et le numéro avec Tesseract.js (moteur et dictionnaires servis par le site),
// 3. on compare la lecture à l'index complet des cartes TCGdex avec une recherche approchée,
//    ce qui corrige les fautes de lecture (« Dracaufcu » -> « Dracaufeu »).
// La photo ne quitte jamais l'appareil.

import { createWorker, PSM, type Worker } from 'tesseract.js';
import { getCard, searchCards, imageUrl, type Card, type CardBrief, type Lang } from './tcgdex';
import { loadIndex, coreName, normalize, similarity, preloadIndexes } from './cardindex';
export { preloadIndexes };
import { url } from './ui';

export interface ScanReading {
  name: string;
  number?: string;
  total?: number;
  hp?: number;
  raw: string;
  art?: Float32Array[]; // empreintes de l'illustration photographiée (légers décalages)
}

export interface Candidate extends CardBrief {
  lang: Lang;
  setName?: string;
  score: number;
  card?: Card; // détails (PV, cote) pour les meilleures correspondances
}

type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
type Progress = (p: number, label: string) => void;

/* ------------------------------------------------------------------ */
/* Moteur OCR                                                          */
/* ------------------------------------------------------------------ */

let workerPromise: Promise<Worker> | null = null;
let progressCb: Progress = () => {};

function getWorker(onProgress: Progress): Promise<Worker> {
  progressCb = onProgress;
  if (!workerPromise) {
    const abs = (p: string) => new URL(url(p), location.href).href;
    workerPromise = createWorker(['eng', 'fra'], 1, {
      workerPath: abs('/ocr/worker.min.js'),
      corePath: abs('/ocr'),
      langPath: abs('/ocr'),
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (/load|init/i.test(m.status)) progressCb(m.progress ?? 0, 'Préparation du scanner (première fois : quelques secondes)…');
      },
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Précharge le moteur en arrière-plan (ouverture de la page scanner). */
export function warmUp() {
  getWorker(() => {}).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Image                                                               */
/* ------------------------------------------------------------------ */

export async function loadImage(file: Blob): Promise<Source> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch { /* repli */ }
  }
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

const dims = (s: Source) =>
  s instanceof HTMLVideoElement ? { w: s.videoWidth, h: s.videoHeight } : { w: s.width, h: s.height };

export interface Rect { x: number; y: number; w: number; h: number } // en pixels de la source

/** Copie une zone de la source dans un canvas (redressé à la taille demandée). */
export function cut(src: Source, r: Rect, outW: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(outW);
  c.height = Math.max(1, Math.round((r.h / r.w) * outW));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

/**
 * Détection automatique de la carte sur une photo : on cherche le plus grand
 * rectangle délimité par de fortes variations de luminosité (bords de la carte).
 * Renvoie null si rien de convaincant.
 */
export function detectCard(src: Source): Rect | null {
  const { w, h } = dims(src);
  const scale = 320 / Math.max(w, h);
  const sw = Math.round(w * scale), sh = Math.round(h * scale);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, sw, sh);
  const px = ctx.getImageData(0, 0, sw, sh).data;
  const g = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  // Gradients horizontaux / verticaux cumulés par colonne et par ligne.
  const colE = new Float32Array(sw), rowE = new Float32Array(sh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      colE[x] += Math.abs(g[i + 1] - g[i - 1]);
      rowE[y] += Math.abs(g[i + sw] - g[i - sw]);
    }
  }
  const pick = (arr: Float32Array, n: number) => {
    // Bord gauche/haut : pic dans le premier 45 %, bord droit/bas : pic dans le dernier 45 %.
    const smooth = (i: number) => (arr[i - 1] ?? 0) + arr[i] + (arr[i + 1] ?? 0);
    let a = 1, b = n - 2;
    for (let i = 1; i < n * 0.45; i++) if (smooth(i) > smooth(a)) a = i;
    for (let i = n - 2; i > n * 0.55; i--) if (smooth(i) > smooth(b)) b = i;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    return { a, b, strong: smooth(a) > mean * 4.5 && smooth(b) > mean * 4.5 };
  };
  const X = pick(colE, sw), Y = pick(rowE, sh);
  if (!X.strong || !Y.strong) return null;
  const rw = X.b - X.a, rh = Y.b - Y.a;
  const ratio = rw / rh; // carte : 63/88 ≈ 0.716
  if (rw < sw * 0.3 || rh < sh * 0.3 || ratio < 0.6 || ratio > 0.85) return null;
  return { x: X.a / scale, y: Y.a / scale, w: rw / scale, h: rh / scale };
}

/** Rectangle « toute l'image », recadré au format carte et centré. */
export function centeredCard(src: Source, fill = 1): Rect {
  const { w, h } = dims(src);
  const R = 63 / 88;
  let cw = w * fill, ch = cw / R;
  if (ch > h * fill) { ch = h * fill; cw = ch * R; }
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

/** Niveaux de gris + contraste ; option seuil d'Otsu et inversion (texte clair sur fond sombre). */
function prepare(canvas: HTMLCanvasElement, mode: 'gray' | 'otsu' | 'invert'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const p = img.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
    p[i] = v;
    hist[v]++;
  }
  let t = 128;
  if (mode !== 'gray') {
    const total = p.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; t = i; }
    }
  }
  for (let i = 0; i < p.length; i += 4) {
    let v = p[i];
    if (mode === 'gray') v = Math.max(0, Math.min(255, (v - 128) * 1.5 + 128));
    else v = v > t ? 255 : 0;
    if (mode === 'invert') v = 255 - v;
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ */
/* Lecture du texte                                                    */
/* ------------------------------------------------------------------ */

const NOISE_WORDS = new Set(['pv', 'hp', 'base', 'basic', 'de', 'niveau', 'stade', 'stage', 'evolution', 'ex', 'gx', 'v', 'vmax', 'vstar', 'tag', 'team', 'lv', 'niv']);

export function parseName(text: string): string {
  let source = text.split('\n').filter((l) => !/(évolu|evolu|evolv)/i.test(l));
  const withHp = source.filter((l) => /\b(PV|HP)\s*\d/i.test(l));
  if (withHp.length) source = withHp;
  const words = source
    .join(' ')
    .replace(/\b(PV|HP)\s*\d+/gi, ' ')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’.\-\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-'’.]+|[-'’.]+$/g, ''))
    .filter((w) => w.length >= 3 && !NOISE_WORDS.has(normalize(w)));
  // On garde la suite de mots la plus longue (noms composés : « Professeur Chen », « Mew Rayonnant »).
  return words.slice(0, 3).join(' ');
}

export function parseNumber(text: string): { number?: string; total?: number } {
  const cleaned = text.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/\s+/g, ' ');
  const m = cleaned.match(/(\d{1,3})\s*\/\s*(\d{2,3})/);
  if (!m) return {};
  return { number: String(Number(m[1])), total: Number(m[2]) };
}

export function parseHp(text: string): number | undefined {
  const m = text.replace(/[oO]/g, '0').match(/(?:PV|HP)?\s*(\d{2,3})\s*$/m) ?? text.match(/(\d{2,3})/);
  const v = m ? Number(m[1]) : NaN;
  return v >= 30 && v <= 400 && v % 10 === 0 ? v : undefined;
}

async function ocr(worker: Worker, canvas: HTMLCanvasElement, psm: PSM, whitelist = ''): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist });
  return (await worker.recognize(canvas)).data.text;
}

/** Lit nom et numéro sur une carte déjà isolée (rectangle au format carte). */
async function readZones(worker: Worker, src: Source, card: Rect): Promise<ScanReading> {
  const at = (x0: number, y0: number, x1: number, y1: number): Rect => ({
    x: card.x + card.w * x0, y: card.y + card.h * y0, w: card.w * (x1 - x0), h: card.h * (y1 - y0),
  });
  const nameZone = cut(src, at(0.03, 0.02, 0.82, 0.115), 1200);
  const numZones = [cut(src, at(0, 0.875, 0.5, 0.985), 1000), cut(src, at(0.5, 0.875, 1, 0.985), 1000)];

  const hpZone = cut(src, at(0.6, 0.02, 0.98, 0.115), 800);
  let name = '', raw = '';
  for (const mode of ['gray', 'otsu', 'invert'] as const) {
    const t = await ocr(worker, prepare(nameZone, mode), PSM.SINGLE_LINE);
    raw += t + '\n';
    name = parseName(t);
    if (name.length >= 4) break;
  }

  if (name.length < 4) {
    // Repli : zone de nom plus serrée (cartes récentes, mention « DE BASE » à gauche).
    const alt = cut(src, at(0.12, 0.03, 0.72, 0.1), 1200);
    for (const mode of ['gray', 'otsu'] as const) {
      const t = await ocr(worker, prepare(alt, mode), PSM.SINGLE_LINE);
      raw += t + '\n';
      const n2 = parseName(t);
      if (n2.length > name.length) name = n2;
      if (name.length >= 4) break;
    }
  }

  let num: { number?: string; total?: number } = {};
  outer: for (const zone of numZones) {
    for (const mode of ['gray', 'otsu', 'invert'] as const) {
      const t = await ocr(worker, prepare(zone, mode), PSM.SPARSE_TEXT, '0123456789/');
      raw += t + '\n';
      num = parseNumber(t);
      if (num.number) break outer;
    }
  }
  if (!num.number) {
    // Repli : toute la bande du bas, lue comme une seule ligne.
    const strip = cut(src, at(0, 0.86, 1, 0.99), 1400);
    for (const mode of ['gray', 'otsu', 'invert'] as const) {
      const t = await ocr(worker, prepare(strip, mode), PSM.SINGLE_LINE, '0123456789/');
      raw += t + '\n';
      num = parseNumber(t);
      if (num.number) break;
    }
  }
  let hp: number | undefined;
  for (const mode of ['gray', 'otsu'] as const) {
    const t = await ocr(worker, prepare(hpZone, mode), PSM.SINGLE_LINE, '0123456789PVH ');
    raw += t + '\n';
    hp = parseHp(t);
    if (hp) break;
  }
  // Plusieurs empreintes légèrement décalées : tolère un cadrage imparfait.
  const shifts = [[0, 0], [-0.03, 0], [0.03, 0], [0, -0.02], [0, 0.02]];
  const art = shifts.map(([dx, dy]) => fingerprint(src, card, dx, dy)).filter(Boolean) as Float32Array[];
  return { name, ...num, hp, raw, art: art.length ? art : undefined };
}

/* ------------------------------------------------------------------ */
/* Empreinte visuelle de l'illustration                                */
/* ------------------------------------------------------------------ */

const FP_W = 16, FP_H = 10;

/** Couleurs moyennes de l'illustration sur une grille 16 x 10 (valeurs RVB entre 0 et 1). */
function fingerprint(src: CanvasImageSource, r: Rect, dx = 0, dy = 0): Float32Array | undefined {
  try {
    const c = document.createElement('canvas');
    c.width = FP_W; c.height = FP_H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, r.x + r.w * (0.09 + dx), r.y + r.h * (0.12 + dy), r.w * 0.82, r.h * 0.36, 0, 0, FP_W, FP_H);
    const d = ctx.getImageData(0, 0, FP_W, FP_H).data; // lève une erreur si l'image est « protégée » (CORS)
    const out = new Float32Array(FP_W * FP_H * 3);
    for (let i = 0; i < FP_W * FP_H; i++) for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = d[i * 4 + ch] / 255;
    return out;
  } catch {
    return undefined;
  }
}

/**
 * Ressemblance entre deux illustrations, entre 0 et 1 :
 * moitié couleurs (chromaticité, insensible à la luminosité),
 * moitié formes (corrélation des niveaux de gris).
 */
export function visualSimilarity(a: Float32Array, b: Float32Array): number {
  const n = a.length / 3;
  let chroma = 0;
  const ga = new Float32Array(n), gb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sa = a[i * 3] + a[i * 3 + 1] + a[i * 3 + 2] + 1e-3;
    const sb = b[i * 3] + b[i * 3 + 1] + b[i * 3 + 2] + 1e-3;
    chroma += Math.abs(a[i * 3] / sa - b[i * 3] / sb) + Math.abs(a[i * 3 + 1] / sa - b[i * 3 + 1] / sb);
    ga[i] = sa; gb[i] = sb;
  }
  const colorSim = Math.max(0, 1 - chroma / n / 0.15);
  const stats = (g: Float32Array) => {
    const m = g.reduce((x, y) => x + y, 0) / n;
    const sd = Math.sqrt(g.reduce((x, y) => x + (y - m) ** 2, 0) / n);
    return { m, sd };
  };
  const A = stats(ga), B = stats(gb);
  if (A.sd < 0.03 || B.sd < 0.03) return colorSim; // zone trop uniforme : seules les couleurs comptent
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (ga[i] - A.m) * (gb[i] - B.m);
  const corr = Math.max(0, cov / n / (A.sd * B.sd));
  return 0.5 * colorSim + 0.5 * corr;
}

const fpCache = new Map<string, Promise<Float32Array | undefined>>();

function imageFingerprint(base?: string): Promise<Float32Array | undefined> {
  const src = imageUrl(base, 'low');
  if (!src) return Promise.resolve(undefined);
  if (!fpCache.has(src)) {
    fpCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => resolve(fingerprint(img, { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }));
      img.onerror = () => resolve(undefined);
      img.src = src;
    }));
  }
  return fpCache.get(src)!;
}

/**
 * Lit une carte. `card` = rectangle connu (cadre de visée de la caméra) ;
 * sinon on essaie la détection automatique, puis l'image entière.
 * Plusieurs images (rafale de la caméra) : on fusionne les meilleures lectures.
 */
/** `card` : un cadrage pour toutes les images, ou une liste de cadrages par image (caméra). */
export async function readCard(input: Source | Source[], onProgress: Progress, card?: Rect | Rect[][]): Promise<ScanReading> {
  const worker = await getWorker(onProgress);
  const frames = Array.isArray(input) ? input : [input];
  const jobs: { src: Source; rect: Rect }[] = [];
  for (const [k, src] of frames.entries()) {
    const given = Array.isArray(card) ? card[k] : card ? [card] : undefined;
    const rects = given?.length ? given : ([detectCard(src), centeredCard(src), centeredCard(src, 0.85)].filter(Boolean) as Rect[]);
    rects.forEach((rect) => jobs.push({ src, rect }));
  }
  const q = (x: ScanReading) => (x.name.length >= 4 ? 1 : 0) + (x.number ? 1 : 0) + (x.total ? 0.5 : 0) + (x.hp ? 0.25 : 0);
  let best: ScanReading = { name: '', raw: '' };
  const numbers = new Map<string, number>();
  for (let i = 0; i < jobs.length; i++) {
    onProgress(i / jobs.length, 'Lecture de la carte…');
    const r = await readZones(worker, jobs[i].src, jobs[i].rect);
    if (r.number) {
      const k = `${r.number}/${r.total ?? ''}`;
      numbers.set(k, (numbers.get(k) ?? 0) + 1);
    }
    if (q(r) > q(best)) best = { ...r, name: r.name || best.name, hp: r.hp ?? best.hp, art: r.art ?? best.art };
    else best = { ...best, name: best.name || r.name, hp: best.hp ?? r.hp, art: best.art ?? r.art };
    if (q(best) >= 2.75) break;
  }
  // Vote sur le numéro si plusieurs lectures divergent.
  if (numbers.size > 1) {
    const [k] = [...numbers.entries()].sort((a, b) => b[1] - a[1])[0];
    const [n, t] = k.split('/');
    best.number = n;
    best.total = t ? Number(t) : best.total;
  }
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '' });
  return best;
}

/* ------------------------------------------------------------------ */
/* Correspondance avec l'index des cartes                              */
/* ------------------------------------------------------------------ */

const sameNumber = (localId: string, n: string) =>
  localId.replace(/^0+/, '').toLowerCase() === n.replace(/^0+/, '').toLowerCase();

/** Classement sur le texte seul : nom (60 %), numéro (25 %), taille de l'extension (15 %). */
async function textCandidates(r: Pick<ScanReading, 'name' | 'number' | 'total'>): Promise<Candidate[]> {
  const q = coreName(r.name);
  const results: Candidate[] = [];
  const settled = await Promise.allSettled([loadIndex('fr'), loadIndex('en')]);
  (['fr', 'en'] as Lang[]).forEach((lang, i) => {
    const s = settled[i];
    if (s.status !== 'fulfilled') return;
    const { cards, sets } = s.value;
    const pool = r.number ? cards.filter((c) => sameNumber(c.localId, r.number!)) : cards;
    for (const c of pool) {
      const nameScore = q.length >= 3 ? similarity(q, c.core) : 0;
      const numScore = r.number && sameNumber(c.localId, r.number) ? 1 : 0;
      const set = sets.get(c.setId);
      const totalScore = r.total && set && set.official === r.total ? 1 : 0;
      const score = 0.6 * nameScore + 0.25 * numScore + 0.15 * totalScore;
      if (score >= 0.35) results.push({ ...c, lang, setName: set?.name, score });
    }
  });

  if (settled.every((s) => s.status === 'rejected')) {
    // Index indisponible : recherche classique par nom.
    for (const lang of ['fr', 'en'] as Lang[]) {
      const found = await searchCards(r.name, lang, 100).catch(() => [] as CardBrief[]);
      for (const c of found) {
        const numScore = r.number && sameNumber(c.localId, r.number) ? 1 : 0;
        results.push({ ...c, lang, score: 0.6 * similarity(q, coreName(c.name)) + 0.25 * numScore });
      }
      if (results.length) break;
    }
    if (!results.length) throw new Error('Index indisponible');
  }

  if (!results.some((c) => c.score >= 0.6) && r.number && q.length >= 3) {
    return textCandidates({ name: r.name });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}

/**
 * Classe les cartes selon la lecture, puis affine les meilleures avec
 * les points de vie et la ressemblance de l'illustration.
 */
export async function findCandidates(r: Pick<ScanReading, 'name' | 'number' | 'total' | 'hp' | 'art'>): Promise<Candidate[]> {
  const list = await textCandidates(r);
  const top = list.slice(0, 8);
  const vis = new Map<Candidate, number>();
  await Promise.all(
    top.map(async (c) => {
      const [card, fp] = await Promise.all([
        getCard(c.id, c.lang).catch(() => null),
        r.art ? imageFingerprint(c.image) : Promise.resolve(undefined),
      ]);
      if (card) {
        c.card = card;
        c.setName = c.setName ?? card.set?.name;
        if (r.hp && card.hp) c.score += card.hp === r.hp ? 0.1 : -0.05;
      }
      if (r.art && fp) vis.set(c, Math.max(...r.art.map((a) => visualSimilarity(a, fp))));
    }),
  );
  // Illustration : bonus pour la plus ressemblante, comparée aux autres candidates.
  if (vis.size) {
    const values = [...vis.values()];
    const ref = values.length >= 2 ? values.reduce((x, y) => x + y, 0) / values.length : 0.4;
    for (const [c, v] of vis) c.score += 0.3 * (v - ref);
  }
  if (location.search.includes('debug')) {
    for (const c of top) console.info('[scan] ' + JSON.stringify({ id: c.id, lang: c.lang, score: c.score, hp: c.card?.hp, readHp: r.hp, vis: vis.get(c) }));
  }
  list.sort((a, b) => b.score - a.score);
  return list.slice(0, 24).map((c) => ({ ...c, score: Math.min(1, c.score) }));
}
