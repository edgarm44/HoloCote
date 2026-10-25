// Sauvegarde complète de la progression (classeur, favoris, Défi, quêtes, succès, pseudo...)
// sous forme de fichier ou de code à copier. Rien n'est envoyé : le fichier ou le code reste chez l'utilisateur.

import { importJson } from './collection';

const PREFIX = 'holocote.';
// Copies de données publiques rechargeables : inutiles dans une sauvegarde.
const SKIP = /^holocote\.(market|api|camera|alerts\.state)/;
const STAMP = 'holocote.backup.v1';
const MAX_BYTES = 3_000_000;

interface Backup { app: 'holocote-backup'; version: 1; at: number; data: Record<string, string> }

function collect(): Backup {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX) || SKIP.test(k) || k === STAMP) continue;
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    }
  } catch { /* stockage indisponible */ }
  return { app: 'holocote-backup', version: 1, at: Date.now(), data };
}

function stamp() {
  try { localStorage.setItem(STAMP, String(Date.now())); } catch { /* rien */ }
}

/** Date de la dernière sauvegarde (ms) ou 0. */
export function lastBackup(): number {
  try { return Number(localStorage.getItem(STAMP)) || 0; } catch { return 0; }
}

/** Télécharge un fichier .json contenant toute la progression. */
export function downloadBackup() {
  const json = JSON.stringify(collect());
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `holocote-sauvegarde-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  stamp();
}

/* ---------- Code de sauvegarde (compressé, à copier-coller) ---------- */
const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const codeSupported = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** Code texte « HC1-... » qui contient toute la progression. */
export async function backupCode(): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(collect()));
  const packed = codeSupported() ? await pipe(json, new CompressionStream('deflate-raw')) : json;
  stamp();
  return `${codeSupported() ? 'HC1' : 'HC0'}-${b64url(packed)}`;
}

/* ---------- Restauration ---------- */
async function parse(input: string): Promise<Backup> {
  const text = input.trim();
  let json: string;
  const m = /^HC([01])-([A-Za-z0-9_-]+)$/.exec(text.replace(/\s+/g, ''));
  if (m) {
    if (m[1] === '1' && !codeSupported()) throw new Error('Ce navigateur ne sait pas lire ce code. Utilise plutôt le fichier.');
    try {
      const bytes = fromB64url(m[2]);
      json = new TextDecoder().decode(m[1] === '1' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes);
    } catch {
      throw new Error('Code incomplet ou abîmé : vérifie que tu l’as copié en entier.');
    }
  } else json = text;
  if (json.length > MAX_BYTES) throw new Error('Sauvegarde trop volumineuse.');
  let d: unknown;
  try { d = JSON.parse(json); } catch { throw new Error('Code ou fichier non reconnu.'); }
  // Un simple export de collection (onglet Collection) est aussi accepté.
  if (d && typeof d === 'object' && (d as { app?: string }).app === 'holocote') {
    return { app: 'holocote-backup', version: 1, at: Date.now(), data: { 'holocote.collection.v1': json } };
  }
  const b = d as Partial<Backup>;
  if (!b || b.app !== 'holocote-backup' || !b.data || typeof b.data !== 'object') throw new Error('Ce n’est pas une sauvegarde HoloDex.');
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.data)) {
    if (/^holocote\.[\w.]{1,60}$/.test(k) && !SKIP.test(k) && typeof v === 'string' && v.length < 1_500_000) data[k] = v;
  }
  return { app: 'holocote-backup', version: 1, at: typeof b.at === 'number' ? b.at : Date.now(), data };
}

/** Aperçu d'une sauvegarde avant de la restaurer. */
export async function previewBackup(input: string): Promise<{ at: number; cards: number; keys: number }> {
  const b = await parse(input);
  let cards = 0;
  try { cards = (JSON.parse(b.data['holocote.collection.v1'] ?? '{}').items ?? []).length; } catch { /* rien */ }
  return { at: b.at, cards, keys: Object.keys(b.data).length };
}

/** Remplace la progression de ce navigateur par celle de la sauvegarde. */
export async function restoreBackup(input: string): Promise<void> {
  const b = await parse(input);
  const col = b.data['holocote.collection.v1'];
  const { ['holocote.collection.v1']: _, ...rest } = b.data;
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && !SKIP.test(k)) old.push(k);
  }
  old.forEach((k) => localStorage.removeItem(k));
  for (const [k, v] of Object.entries(rest)) localStorage.setItem(k, v);
  // Le classeur passe par la validation stricte de la collection.
  if (col) importJson(col, 'replace');
  // Les succès déjà obtenus ne doivent pas tous réapparaître en notification.
  localStorage.removeItem('holocote.badges.v1');
  stamp();
}
