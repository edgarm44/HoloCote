// Scanner gratuit, entièrement dans le navigateur :
// 1. on isole la carte (cadre de visée de la caméra, ou détection automatique sur une photo),
// 2. on lit le nom et le numéro avec Tesseract.js (moteur et dictionnaires servis par le site),
// 3. on compare la lecture à l'index complet des cartes TCGdex avec une recherche approchée,
//    ce qui corrige les fautes de lecture (« Dracaufcu » -> « Dracaufeu »).
// La photo ne quitte jamais l'appareil.

import { createWorker, PSM, type Worker } from 'tesseract.js';
import { listSets, type CardBrief, type Lang } from './tcgdex';
import { url } from './ui';

export interface ScanReading {
  name: string;
  number?: string;
  total?: number;
  raw: string;
}

export interface Candidate extends CardBrief {
  lang: Lang;
  setName?: string;
  score: number;
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

  let name = '', raw = '';
  for (const mode of ['gray', 'otsu', 'invert'] as const) {
    const t = await ocr(worker, prepare(nameZone, mode), PSM.SINGLE_LINE);
    raw += t + '\n';
    name = parseName(t);
    if (name.length >= 4) break;
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
  return { name, ...num, raw };
}

/**
 * Lit une carte. `card` = rectangle connu (cadre de visée de la caméra) ;
 * sinon on essaie la détection automatique, puis l'image entière.
 */
export async function readCard(src: Source, onProgress: Progress, card?: Rect): Promise<ScanReading> {
  const worker = await getWorker(onProgress);
  const hypotheses: Rect[] = card ? [card] : [detectCard(src), centeredCard(src), centeredCard(src, 0.85)].filter(Boolean) as Rect[];
  let best: ScanReading = { name: '', raw: '' };
  for (let i = 0; i < hypotheses.length; i++) {
    onProgress(i / hypotheses.length, 'Lecture de la carte…');
    const r = await readZones(worker, src, hypotheses[i]);
    const q = (x: ScanReading) => (x.name.length >= 4 ? 1 : 0) + (x.number ? 1 : 0) + (x.total ? 0.5 : 0);
    if (q(r) > q(best)) best = r;
    if (best.name.length >= 4 && best.number && best.total) break;
  }
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '' });
  return best;
}

/* ------------------------------------------------------------------ */
/* Correspondance avec l'index des cartes                              */
/* ------------------------------------------------------------------ */

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Nom sans les suffixes de mécanique de jeu (ex, V, VMAX…). */
function coreName(s: string): string {
  return normalize(
    s.replace(/\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.?X|Prime|Star|δ|◇|☆)\b/g, ' '),
  );
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.length >= 4 && a.includes(b)) return 0.95;
  if (a.length >= 4 && b.includes(a)) return 0.9;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

interface IndexEntry extends CardBrief { core: string; setId: string }
interface CardIndex { cards: IndexEntry[]; sets: Map<string, { name: string; official: number }> }

const indexes = new Map<Lang, Promise<CardIndex>>();

function loadIndex(lang: Lang): Promise<CardIndex> {
  if (!indexes.has(lang)) {
    const p = (async () => {
      const [cards, sets] = await Promise.all([
        fetch(`https://api.tcgdex.net/v2/${lang}/cards`).then((r) => {
          if (!r.ok) throw new Error(`TCGdex ${r.status}`);
          return r.json() as Promise<CardBrief[]>;
        }),
        listSets(lang),
      ]);
      return {
        cards: cards.map((c) => ({ ...c, core: coreName(c.name), setId: c.id.slice(0, c.id.length - c.localId.length - 1) })),
        sets: new Map(sets.map((s) => [s.id, { name: s.name, official: s.cardCount?.official ?? 0 }])),
      };
    })();
    p.catch(() => indexes.delete(lang));
    indexes.set(lang, p);
  }
  return indexes.get(lang)!;
}

/** Précharge les index FR et EN (pendant que l'utilisateur vise). */
export function preloadIndexes() {
  loadIndex('fr').catch(() => {});
  loadIndex('en').catch(() => {});
}

const sameNumber = (localId: string, n: string) =>
  localId.replace(/^0+/, '').toLowerCase() === n.replace(/^0+/, '').toLowerCase();

/**
 * Classe les cartes selon la lecture : ressemblance du nom (60 %),
 * numéro exact (25 %), nombre de cartes de l'extension (15 %).
 */
export async function findCandidates(r: Pick<ScanReading, 'name' | 'number' | 'total'>): Promise<Candidate[]> {
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
  if (settled.every((s) => s.status === 'rejected')) throw new Error('Index indisponible');

  // Si le numéro a été mal lu, on retente sur le nom seul.
  if (!results.some((c) => c.score >= 0.6) && r.number && q.length >= 3) {
    return findCandidates({ name: r.name });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 24);
}
