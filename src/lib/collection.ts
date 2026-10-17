// Collection stockée uniquement dans le navigateur (localStorage).
// Rien n'est envoyé sur un serveur. Export / import par fichier JSON pour
// sauvegarder ou changer d'appareil.

import { isCondition, type Condition } from './condition';
import type { Lang } from './tcgdex';

export interface Item {
  cardId: string;
  lang: Lang;
  name: string;
  image?: string;
  setName?: string;
  rarity?: string;
  condition: Condition;
  quantity: number;
  addedAt: number;
}

interface Store {
  app: 'holocote';
  version: 1;
  items: Item[];
}

const KEY = 'holocote.collection.v1';
let memory: Store = { app: 'holocote', version: 1, items: [] }; // secours si le stockage est bloqué

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = validate(JSON.parse(raw));
      if (parsed) memory = parsed;
    }
  } catch {
    /* stockage indisponible (navigation privée stricte) : on garde la mémoire */
  }
  return memory;
}

function save(store: Store): boolean {
  memory = store;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('holocote:collection'));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent('holocote:collection'));
    return false;
  }
}

export function storageAvailable(): boolean {
  try {
    const k = '__holocote_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const sameLine = (a: Pick<Item, 'cardId' | 'lang' | 'condition'>, b: Pick<Item, 'cardId' | 'lang' | 'condition'>) =>
  a.cardId === b.cardId && a.lang === b.lang && a.condition === b.condition;

export function getItems(): Item[] {
  return [...load().items].sort((a, b) => b.addedAt - a.addedAt);
}

export function countCards(): number {
  return load().items.reduce((n, i) => n + i.quantity, 0);
}

export function addItem(item: Omit<Item, 'addedAt'>): void {
  const store = load();
  const existing = store.items.find((i) => sameLine(i, item));
  if (existing) existing.quantity = Math.min(999, existing.quantity + item.quantity);
  else store.items.push({ ...item, quantity: clampQty(item.quantity), addedAt: Date.now() });
  save(store);
}

export function updateItem(key: Pick<Item, 'cardId' | 'lang' | 'condition'>, patch: Partial<Pick<Item, 'quantity' | 'condition'>>): void {
  const store = load();
  const item = store.items.find((i) => sameLine(i, key));
  if (!item) return;
  if (patch.quantity !== undefined) item.quantity = clampQty(patch.quantity);
  if (patch.condition && patch.condition !== item.condition) {
    const target = store.items.find((i) => sameLine(i, { ...item, condition: patch.condition! }));
    if (target) {
      target.quantity = clampQty(target.quantity + item.quantity);
      store.items = store.items.filter((i) => i !== item);
    } else {
      item.condition = patch.condition;
    }
  }
  save(store);
}

export function removeItem(key: Pick<Item, 'cardId' | 'lang' | 'condition'>): void {
  const store = load();
  store.items = store.items.filter((i) => !sameLine(i, key));
  save(store);
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
  memory = { app: 'holocote', version: 1, items: [] };
  window.dispatchEvent(new CustomEvent('holocote:collection'));
}

export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

/** Importe un fichier exporté. mode « merge » additionne les quantités, « replace » remplace tout. */
export function importJson(text: string, mode: 'merge' | 'replace'): number {
  const incoming = validate(JSON.parse(text));
  if (!incoming) throw new Error('Fichier non reconnu');
  if (mode === 'replace') {
    save(incoming);
    return incoming.items.length;
  }
  const store = load();
  for (const it of incoming.items) {
    const ex = store.items.find((i) => sameLine(i, it));
    if (ex) ex.quantity = clampQty(ex.quantity + it.quantity);
    else store.items.push(it);
  }
  save(store);
  return incoming.items.length;
}

function clampQty(n: number): number {
  return Math.max(1, Math.min(999, Math.round(Number(n) || 1)));
}

const str = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;

/** Valide strictement un contenu (localStorage ou fichier importé). */
function validate(data: unknown): Store | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<Store>;
  if (d.app !== 'holocote' || !Array.isArray(d.items)) return null;
  const items: Item[] = [];
  for (const raw of d.items.slice(0, 5000)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const cardId = str(r.cardId, 64);
    const name = str(r.name);
    if (!cardId || !/^[\w.\-]+$/.test(cardId) || !name) continue;
    if (r.lang !== 'fr' && r.lang !== 'en') continue;
    if (!isCondition(r.condition)) continue;
    const image = str(r.image, 300);
    items.push({
      cardId,
      lang: r.lang,
      name,
      image: image && image.startsWith('https://assets.tcgdex.net/') ? image : undefined,
      setName: str(r.setName),
      rarity: str(r.rarity, 80),
      condition: r.condition,
      quantity: clampQty(r.quantity as number),
      addedAt: typeof r.addedAt === 'number' ? r.addedAt : Date.now(),
    });
  }
  return { app: 'holocote', version: 1, items };
}
