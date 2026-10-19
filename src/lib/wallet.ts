// Éclats : la monnaie du jeu HoloCote, gagnée avec les quêtes du jour, le coffre et les niveaux,
// dépensée dans la boutique. Aucune valeur réelle : rien ne s'achète avec de l'argent, rien ne s'échange.

import { todayNumber } from './mystery';

export const COIN = 'Éclats';
export const COIN_ONE = 'Éclat';
const KEY = 'holocote.coins.v1';
const SKINS = 'holocote.skins.v1';
const POTION = 'holocote.potion.v1';
const DUEL = 'holocote.duelsalt.v1';
const MYST = 'holocote.mystextra.v1';

interface Wallet { balance: number; earned: number; spent: number; log: { t: number; n: number; why: string }[] }
function read(): Wallet {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.balance === 'number') return { balance: Math.max(0, Math.floor(v.balance)), earned: v.earned ?? 0, spent: v.spent ?? 0, log: Array.isArray(v.log) ? v.log : [] };
  } catch { /* rien */ }
  return { balance: 0, earned: 0, spent: 0, log: [] };
}
const write = (w: Wallet) => { try { localStorage.setItem(KEY, JSON.stringify({ ...w, log: w.log.slice(-30) })); } catch { /* rien */ } };
const ping = () => window.dispatchEvent(new CustomEvent('holocote:coins'));

export const coins = () => read().balance;
export const coinLog = () => read().log.slice().reverse();
export const fmtCoins = (n: number) => `${n.toLocaleString('fr-FR')} ${n > 1 ? COIN : COIN_ONE}`;

export function addCoins(n: number, why: string) {
  if (!(n > 0)) return;
  const w = read();
  w.balance += Math.round(n); w.earned += Math.round(n);
  w.log.push({ t: Date.now(), n: Math.round(n), why });
  write(w); ping();
}
export function spendCoins(n: number, why: string): boolean {
  const w = read();
  if (w.balance < n) return false;
  w.balance -= n; w.spent += n;
  w.log.push({ t: Date.now(), n: -n, why });
  write(w); ping();
  return true;
}

/* ---------- Apparences achetées ---------- */
export interface Skins { owned: string[]; banner: string; pack: string }
export function skins(): Skins {
  try {
    const v = JSON.parse(localStorage.getItem(SKINS) || 'null');
    if (v && Array.isArray(v.owned)) return { owned: v.owned.filter((x: unknown) => typeof x === 'string'), banner: typeof v.banner === 'string' ? v.banner : '', pack: typeof v.pack === 'string' ? v.pack : '' };
  } catch { /* rien */ }
  return { owned: [], banner: '', pack: '' };
}
const writeSkins = (s: Skins) => { try { localStorage.setItem(SKINS, JSON.stringify(s)); } catch { /* rien */ } ping(); };
export const owns = (id: string) => skins().owned.includes(id);
export function grantSkin(id: string) { const s = skins(); if (!s.owned.includes(id)) s.owned.push(id); writeSkins(s); }
export function equip(kind: 'banner' | 'pack', id: string) {
  const s = skins();
  if (id && !s.owned.includes(kind === 'banner' ? `bn:${id}` : id)) return;
  s[kind] = id;
  writeSkins(s);
}

/* ---------- Potion d'XP (XP des quêtes doublée pour la journée) ---------- */
export const potionActive = () => { try { return Number(localStorage.getItem(POTION)) === todayNumber(); } catch { return false; } };
export function drinkPotion() { try { localStorage.setItem(POTION, String(todayNumber())); } catch { /* rien */ } ping(); }

/* ---------- Nouveau duel du jour ---------- */
export function duelSalt(): number {
  try { const v = JSON.parse(localStorage.getItem(DUEL) || 'null'); return v && v.day === todayNumber() ? Number(v.salt) || 0 : 0; } catch { return 0; }
}
export function bumpDuelSalt() {
  try { localStorage.setItem(DUEL, JSON.stringify({ day: todayNumber(), salt: duelSalt() + 1 })); localStorage.removeItem('holocote.duel.day.v1'); } catch { /* rien */ }
}

/* ---------- Seconde chance à la carte mystère (+3 essais, une fois par jour) ---------- */
export function mysteryExtra(n = todayNumber()): number {
  try { const v = JSON.parse(localStorage.getItem(MYST) || 'null'); return v && v.day === n ? 3 : 0; } catch { return 0; }
}
export function grantMysteryExtra() { try { localStorage.setItem(MYST, JSON.stringify({ day: todayNumber() })); } catch { /* rien */ } }
