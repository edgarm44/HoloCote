// Quêtes du jour : 3 petites missions, les mêmes pour tout le monde un jour donné, qui changent à minuit
// (heure de Paris). Tout est calculé dans le navigateur à partir de ce que le site garde déjà. Aucun gain réel.

import { todayNumber } from './mystery';
import { getLog } from './progress';
import { getItems } from './collection';
import { getFavorites } from './favorites';
import { addXp, addReroll, rerolls, MAX_REROLLS } from './xp';

/* ---------- Pages visitées aujourd'hui (pour les quêtes d'exploration) ---------- */
const VISITS = 'holocote.visits.v1';
interface Visits { day: number; pages: string[]; cards: string[] }

function readVisits(): Visits {
  const day = todayNumber();
  try {
    const v = JSON.parse(localStorage.getItem(VISITS) || 'null') as Visits | null;
    if (v && v.day === day && Array.isArray(v.pages) && Array.isArray(v.cards)) return v;
  } catch { /* rien */ }
  return { day, pages: [], cards: [] };
}

/** Note la page courante (appelé par la mise en page sur chaque page). */
export function recordVisit(path: string, cardKey?: string) {
  const v = readVisits();
  const page = path.replace(/\/+$/, '').split('/').pop() || 'accueil';
  let changed = false;
  if (!v.pages.includes(page)) { v.pages.push(page); changed = true; }
  if (cardKey && !v.cards.includes(cardKey)) { v.cards.push(cardKey); changed = true; }
  if (!changed) return;
  try { localStorage.setItem(VISITS, JSON.stringify(v)); } catch { /* rien */ }
  window.dispatchEvent(new CustomEvent('holocote:progress'));
}

/* ---------- Quêtes ---------- */
export interface Reward { xp: number; reroll?: boolean }
export interface Quest { id: string; title: string; hint: string; href: string; goal: number; value: number; done: boolean; reward: Reward; claimed: boolean }
type Def = { id: string; title: string; hint: string; href: string; goal: number; value: () => number };

const isToday = (t: number) => todayNumber(new Date(t)) === todayNumber();

function defs(): Def[] {
  const today = getLog()[todayNumber()] ?? {};
  const v = readVisits();
  let scans = 0;
  try { const h = JSON.parse(localStorage.getItem('holocote.scans.v1') || '[]'); scans = Array.isArray(h) ? h.filter((x) => x && typeof x.at === 'number' && isToday(x.at)).length : 0; } catch { /* rien */ }
  return [
    { id: 'myst', title: 'Trouve la carte mystère du jour', hint: 'Dans le Défi, devine le Pokémon caché.', href: '/defi/#mystere', goal: 1, value: () => (today.m === 'won' ? 1 : 0) },
    { id: 'myst3', title: 'Trouve la carte mystère en 3 essais ou moins', hint: 'Prends le temps de lire les indices.', href: '/defi/#mystere', goal: 1, value: () => (today.m === 'won' && (today.mt ?? 9) <= 3 ? 1 : 0) },
    { id: 'box', title: 'Ouvre le booster du jour', hint: 'Dix cartes, la dernière est pour toi.', href: '/defi/#booster', goal: 1, value: () => (today.b !== undefined ? 1 : 0) },
    { id: 'duel', title: 'Gagne le duel du jour', hint: 'Laquelle des deux cartes a la plus grosse cote ?', href: '/defi/#duel', goal: 1, value: () => (today.d === 'ok' ? 1 : 0) },
    { id: 'play2', title: 'Joue à 2 jeux du Défi', hint: 'Carte mystère, booster ou duel du jour.', href: '/defi/', goal: 2, value: () => [today.m, today.b !== undefined ? 1 : undefined, today.d].filter(Boolean).length },
    { id: 'add', title: 'Range une carte dans ton classeur', hint: 'Avec le scanner, ou en gagnant une carte au Défi.', href: '/scanner/', goal: 1, value: () => getItems().filter((i) => isToday(i.addedAt)).length },
    { id: 'fav', title: 'Ajoute une carte à tes favoris', hint: 'L’étoile sur la fiche d’une carte.', href: '/recherche/', goal: 1, value: () => getFavorites().filter((f) => isToday(f.addedAt)).length },
    { id: 'cards3', title: 'Consulte 3 fiches de cartes', hint: 'Cherche tes Pokémon préférés.', href: '/recherche/', goal: 3, value: () => v.cards.length },
    { id: 'market', title: 'Jette un œil au Marché', hint: 'Les cartes qui montent et qui baissent.', href: '/marche/', goal: 1, value: () => (v.pages.includes('marche') ? 1 : 0) },
    { id: 'deals', title: 'Regarde les Opportunités', hint: 'Les cartes peut-être bonnes à guetter.', href: '/opportunites/', goal: 1, value: () => (v.pages.includes('opportunites') ? 1 : 0) },
    { id: 'rank', title: 'Vérifie ta place au Classement', hint: 'Où en est ton classeur face aux rivaux ?', href: '/classement/', goal: 1, value: () => (v.pages.includes('classement') ? 1 : 0) },
    { id: 'scan', title: 'Scanne une carte', hint: 'Une photo suffit, même si tu l’as déjà.', href: '/scanner/', goal: 1, value: () => scans },
  ];
}

// Toujours une quête de jeu + deux autres, tirées selon le jour.
const GAME = ['myst', 'box', 'duel', 'play2', 'myst3'];

/** Récompense de chaque quête : la quête de jeu offre une relance du booster du jour, les autres de l'XP. */
const REWARDS: Record<string, Reward> = {
  myst: { xp: 20, reroll: true }, myst3: { xp: 40, reroll: true }, box: { xp: 20, reroll: true }, duel: { xp: 30, reroll: true }, play2: { xp: 30, reroll: true },
  add: { xp: 60 }, fav: { xp: 40 }, cards3: { xp: 40 }, market: { xp: 30 }, deals: { xp: 30 }, rank: { xp: 30 }, scan: { xp: 60 },
};
export const CHEST_XP = 50;

function pickIds(n: number): string[] {
  const all = defs().map((d) => d.id);
  const others = all.filter((id) => !GAME.includes(id));
  let x = (n * 2654435761) >>> 0;
  const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
  const g = GAME[Math.floor(rnd() * GAME.length)];
  const pool = [...others];
  const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  return [g, a, b];
}

export function todayQuests(): Quest[] {
  const all = defs();
  return pickIds(todayNumber()).map((id) => {
    const d = all.find((x) => x.id === id)!;
    const value = Math.min(d.goal, d.value());
    return { id: d.id, title: d.title, hint: d.hint, href: d.href, goal: d.goal, value, done: value >= d.goal, reward: REWARDS[d.id] ?? { xp: 30 }, claimed: claims().ids.includes(d.id) };
  });
}

/* ---------- Récompenses à récupérer ---------- */
const CLAIM = 'holocote.qclaim.v1';
interface Claims { day: number; ids: string[]; chest: boolean }
function claims(): Claims {
  const day = todayNumber();
  try {
    const c = JSON.parse(localStorage.getItem(CLAIM) || 'null') as Claims | null;
    if (c && c.day === day && Array.isArray(c.ids)) return { day, ids: c.ids, chest: !!c.chest };
  } catch { /* rien */ }
  return { day, ids: [], chest: false };
}
const saveClaims = (c: Claims) => { try { localStorage.setItem(CLAIM, JSON.stringify(c)); } catch { /* rien */ } };

export const rewardText = (r: Reward) => (r.reroll ? `relance du booster + ${r.xp} XP` : `+${r.xp} XP`);

/** Récupère la récompense d'une quête terminée. Renvoie un message, ou null si rien à récupérer. */
export function claimQuest(id: string): { xp: number; reroll: boolean; full: boolean } | null {
  const q = todayQuests().find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return null;
  const c = claims();
  c.ids = [...c.ids, id];
  saveClaims(c);
  let reroll = false, full = false;
  if (q.reward.reroll) { reroll = addReroll(); full = !reroll; }
  // Réserve de relances pleine : la relance est convertie en XP.
  addXp(q.reward.xp + (full ? 30 : 0));
  return { xp: q.reward.xp + (full ? 30 : 0), reroll, full };
}

/** Coffre du jour : disponible quand les 3 récompenses sont récupérées. */
export function chestState(): 'locked' | 'ready' | 'open' {
  const c = claims();
  if (c.chest) return 'open';
  const q = todayQuests();
  return q.every((x) => x.claimed) ? 'ready' : 'locked';
}
export function openChest(): number {
  if (chestState() !== 'ready') return 0;
  const c = claims();
  c.chest = true;
  saveClaims(c);
  addXp(CHEST_XP);
  return CHEST_XP;
}

/** Nombre de récompenses à récupérer (quêtes finies non récupérées + coffre prêt). */
export function pendingRewards(): number {
  return todayQuests().filter((x) => x.done && !x.claimed).length + (chestState() === 'ready' ? 1 : 0);
}
export { rerolls, MAX_REROLLS };

/* ---------- Jours où toutes les quêtes ont été terminées ---------- */
const DONE = 'holocote.quests.v1';
export function questDays(): number[] {
  try { const v = JSON.parse(localStorage.getItem(DONE) || '[]'); return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : []; } catch { return []; }
}
/** À appeler après chaque changement : retient le jour si les 3 quêtes sont faites. Renvoie true si c'est nouveau. */
export function checkQuestsDone(): boolean {
  const q = todayQuests();
  if (!q.every((x) => x.done)) return false;
  const days = questDays();
  const n = todayNumber();
  if (days.includes(n)) return false;
  try { localStorage.setItem(DONE, JSON.stringify([...days, n].slice(-400))); } catch { /* rien */ }
  return true;
}
