// Quêtes du jour : 3 petites missions, les mêmes pour tout le monde un jour donné, qui changent à minuit
// (heure de Paris). Tout est calculé dans le navigateur à partir de ce que le site garde déjà. Aucun gain réel.

import { todayNumber } from './mystery';
import { getLog } from './progress';
import { getItems } from './collection';
import { getFavorites } from './favorites';

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
export interface Quest { id: string; title: string; hint: string; href: string; goal: number; value: number; done: boolean }
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
    return { id: d.id, title: d.title, hint: d.hint, href: d.href, goal: d.goal, value, done: value >= d.goal };
  });
}

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
