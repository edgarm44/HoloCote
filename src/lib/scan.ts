// Scanner gratuit : reconnaissance de texte (OCR) dans le navigateur avec Tesseract.js.
// La photo n'est jamais envoyée : seul le moteur OCR et ses dictionnaires sont téléchargés.

import { createWorker, type Worker } from 'tesseract.js';
import { searchCards, listSets, getCard, type CardBrief, type Lang } from './tcgdex';

export interface ScanReading {
  name: string;
  number?: string; // numéro dans l'extension (ex. "136")
  total?: number;  // nombre officiel de cartes de l'extension (ex. 198)
  raw: string;
}

export interface Candidate extends CardBrief {
  lang: Lang;
  setName?: string;
}

let workerPromise: Promise<Worker> | null = null;

function getWorker(onProgress: (p: number, label: string) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(['fra', 'eng'], 1, {
      logger: (m: { status: string; progress: number }) => {
        const label = m.status.includes('loading') || m.status.includes('initializing')
          ? 'Préparation du scanner (première fois : quelques secondes)…'
          : 'Lecture de la carte…';
        onProgress(m.progress ?? 0, label);
      },
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch { /* repli ci-dessous */ }
  }
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

/** Découpe une zone de l'image (en fractions), l'agrandit et la passe en niveaux de gris contrastés. */
function crop(src: ImageBitmap | HTMLImageElement, x0: number, y0: number, x1: number, y1: number, targetW = 1400): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const sx = Math.round(w * x0), sy = Math.round(h * y0);
  const sw = Math.round(w * (x1 - x0)), sh = Math.round(h * (y1 - y0));
  const scale = targetW / sw;
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const NOISE = /\b(pv|hp|base|de base|basic|niveau|stage|stade|évolution|evolution|évolue|evolves|from|de|ex|gx|vmax|vstar|v|tag|team)\b/gi;

export function parseName(text: string): string {
  let source = text.split('\n').filter((l) => !/(évolu|evolu|evolv)/i.test(l));
  // La ligne du nom porte généralement les points de vie (PV / HP).
  const withHp = source.filter((l) => /\b(PV|HP)\s*\d/i.test(l));
  if (withHp.length) source = withHp;
  const lines = source
    .map((l) => l.replace(/\b(PV|HP)\s*\d+/gi, ' ').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.replace(NOISE, '').trim().length >= 3);
  if (!lines.length) return '';
  // La ligne du nom est la plus « lettrée » ; on garde les 1 à 3 premiers mots significatifs.
  const best = lines.sort((a, b) => b.replace(NOISE, '').length - a.replace(NOISE, '').length)[0];
  const words = best.split(' ').filter((w) => w.length >= 2 && !/^(PV|HP|BASE|BASIC)$/i.test(w));
  const longest = words.reduce((a, b) => (b.replace(NOISE, '').length > a.replace(NOISE, '').length ? b : a), '');
  return longest.replace(/^[-'’]+|[-'’]+$/g, '');
}

export function parseNumber(text: string): { number?: string; total?: number } {
  const m = text.replace(/[oO]/g, '0').match(/(\d{1,3})\s*[\/|]\s*(\d{2,3})/);
  if (!m) return {};
  return { number: String(Number(m[1])), total: Number(m[2]) };
}

export async function readCard(file: Blob, onProgress: (p: number, label: string) => void): Promise<ScanReading> {
  const img = await loadBitmap(file);
  const worker = await getWorker(onProgress);
  const top = crop(img, 0.04, 0.02, 0.8, 0.13);
  const bottom = crop(img, 0, 0.84, 1, 0.99);
  const [t, b] = [
    (await worker.recognize(top)).data.text,
    (await worker.recognize(bottom)).data.text,
  ];
  let name = parseName(t);
  let num = parseNumber(b);
  let raw = `${t}\n${b}`;
  if (!name || !num.number) {
    // Photo mal cadrée : lecture de l'image entière.
    const full = (await worker.recognize(crop(img, 0, 0, 1, 1, 1600))).data.text;
    raw += `\n${full}`;
    if (!name) name = parseName(full.split('\n').slice(0, 4).join('\n'));
    if (!num.number) num = parseNumber(full);
  }
  return { name, ...num, raw };
}

const sameNumber = (localId: string, n?: string) =>
  !!n && localId.replace(/^0+/, '').toLowerCase() === n.replace(/^0+/, '').toLowerCase();

/** Cherche les cartes correspondant à une lecture, en français puis en anglais. */
export async function findCandidates(r: Pick<ScanReading, 'name' | 'number' | 'total'>): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (c: CardBrief, lang: Lang, setName?: string) => {
    const k = `${lang}:${c.id}`;
    if (!seen.has(k)) { seen.add(k); out.push({ ...c, lang, setName }); }
  };

  if (r.name.length >= 3) {
    for (const lang of ['fr', 'en'] as Lang[]) {
      const found = await searchCards(r.name, lang, 100).catch(() => []);
      const exact = found.filter((c) => sameNumber(c.localId, r.number));
      (exact.length ? exact : r.number ? [] : found.slice(0, 24)).forEach((c) => push(c, lang));
      if (out.length) break;
    }
  }

  // Repli : numéro + total permettent de deviner l'extension.
  if (!out.length && r.number && r.total) {
    for (const lang of ['fr', 'en'] as Lang[]) {
      const sets = (await listSets(lang).catch(() => [])).filter((s) => s.cardCount?.official === r.total).slice(0, 10);
      const cards = await Promise.all(sets.map((s) => getCard(`${s.id}-${r.number}`, lang).catch(() => null)));
      cards.forEach((c) => c && push(c, lang, c.set?.name));
      if (out.length) break;
    }
  }

  // Dernier recours : le nom seul, même si le numéro ne colle pas.
  if (!out.length && r.name.length >= 3) {
    for (const lang of ['fr', 'en'] as Lang[]) {
      (await searchCards(r.name, lang, 24).catch(() => [])).forEach((c) => push(c, lang));
      if (out.length) break;
    }
  }
  return out.slice(0, 48);
}
