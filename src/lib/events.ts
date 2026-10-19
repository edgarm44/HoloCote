// Événements du week-end : chaque samedi et dimanche, 5 boosters d'une extension à thème à ouvrir
// (à récupérer avant dimanche minuit). La dernière carte de chaque booster peut rejoindre le classeur.
// Jeu gratuit, sans achat ni gain réel. Tout est gardé dans le navigateur.

import { todayNumber, msToMidnight } from './mystery';
import { drawBooster } from './booster';

export interface EventTheme {
  id: string;
  name: string;        // nom de l'événement
  setId: string;       // extension TCGdex des boosters
  setName: string;
  year: string;
  tagline: string;
  decor: 'vintage' | 'jungle' | 'fossil' | 'mega' | 'kanto' | 'prism';
  colors: [string, string, string];
}

export const THEMES: EventTheme[] = [
  { id: 'base', name: 'Week-end rétro', setId: 'base1', setName: 'Set de Base', year: '1999', decor: 'vintage', colors: ['#ffd25a', '#ff8a3d', '#5a3b12'],
    tagline: 'Retour en 1999 : les cartes holo d’origine, celles qui ont tout commencé.' },
  { id: 'jungle', name: 'Expédition Jungle', setId: 'base2', setName: 'Jungle', year: '1999', decor: 'jungle', colors: ['#3dffa8', '#14a37f', '#0b2e20'],
    tagline: 'Feuillages, lianes et holos d’époque : la deuxième extension historique.' },
  { id: 'fossil', name: 'Fouilles Fossile', setId: 'base3', setName: 'Fossile', year: '1999', decor: 'fossil', colors: ['#ffb36b', '#c97b2a', '#2e1b0b'],
    tagline: 'Creuse dans l’ambre : des cartes de 1999 pas vues depuis longtemps.' },
  { id: 'mega', name: 'Nuit Méga', setId: 'me01', setName: 'Méga-Évolution', year: '2025', decor: 'mega', colors: ['#ff4fd8', '#8a7bff', '#1b0f3a'],
    tagline: 'L’énergie Méga déborde : les cartes les plus puissantes de l’ère moderne.' },
  { id: 'kanto', name: 'Fête de Kanto', setId: 'sv03.5', setName: '151', year: '2023', decor: 'kanto', colors: ['#ff4f6d', '#ffd25a', '#2a0f1a'],
    tagline: 'Les 151 originaux remis à neuf, illustrations spéciales comprises.' },
  { id: 'prism', name: 'Éclat prismatique', setId: 'sv08.5', setName: 'Évolutions Prismatiques', year: '2025', decor: 'prism', colors: ['#3ef0ff', '#ff4fd8', '#120b26'],
    tagline: 'Évoli et ses évolutions sous toutes les couleurs de l’arc-en-ciel.' },
];

export const EVENT_BOOSTERS = 5;

/** Le n° 1 (18 octobre 2026) est un dimanche. Samedi et dimanche forment un même week-end d'événement. */
const weekday = (n: number) => (((n - 1) % 7) + 7) % 7; // 0 = dimanche, 6 = samedi
export const isEventDay = (n: number) => weekday(n) === 0 || weekday(n) === 6;
/** Numéro du week-end (le samedi et le dimanche suivant ont le même). */
const weekendOf = (n: number) => Math.floor((n + 1) / 7);
export const themeOf = (n: number) => THEMES[((weekendOf(n) % THEMES.length) + THEMES.length) % THEMES.length];

export interface ActiveEvent { key: number; theme: EventTheme; endsIn: number; lastDay: boolean }

export function activeEvent(n = todayNumber()): ActiveEvent | null {
  if (!isEventDay(n)) return null;
  const sunday = weekday(n) === 0;
  return { key: weekendOf(n), theme: themeOf(n), endsIn: msToMidnight() + (sunday ? 0 : 864e5), lastDay: sunday };
}

export function nextEvent(n = todayNumber()): { inDays: number; theme: EventTheme; startsIn: number } | null {
  for (let k = 1; k < 8; k++) {
    if (isEventDay(n + k)) return { inDays: k, theme: themeOf(n + k), startsIn: msToMidnight() + (k - 1) * 864e5 };
  }
  return null;
}

/* ---------- Boosters de l'événement ---------- */
export interface EventPack { setId: string; cards: string[]; revealed: boolean; claimed: boolean; bonus?: boolean; hitName?: string; hitImage?: string; theme?: string }
interface EventState { key: number; packs: EventPack[] }
const KEY = 'holocote.event.v1';
const BONUS = 'holocote.evbonus.v1';  // boosters bonus achetés à la boutique (utilisables à tout moment)
const BONUS_PACKS = 'holocote.evbonuspacks.v1';
const STATS = 'holocote.evstats.v1';

function readState(key: number): EventState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as EventState | null;
    if (s && s.key === key && Array.isArray(s.packs)) return s;
  } catch { /* rien */ }
  return { key, packs: [] };
}
const writeState = (s: EventState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* rien */ } };

export function eventPacks(ev = activeEvent()): EventPack[] {
  return ev ? readState(ev.key).packs : [];
}
export function packsLeft(ev = activeEvent()): number {
  return ev ? Math.max(0, EVENT_BOOSTERS - readState(ev.key).packs.length) : 0;
}

/** Boosters bonus (boutique). */
export function bonusTickets(): number {
  try { return Math.max(0, Math.floor(Number(localStorage.getItem(BONUS)) || 0)); } catch { return 0; }
}
export function addBonusTicket(n = 1) {
  try { localStorage.setItem(BONUS, String(bonusTickets() + n)); } catch { /* rien */ }
  window.dispatchEvent(new CustomEvent('holocote:progress'));
}
export function bonusPacks(): EventPack[] {
  try { const v = JSON.parse(localStorage.getItem(BONUS_PACKS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
const writeBonusPacks = (p: EventPack[]) => { try { localStorage.setItem(BONUS_PACKS, JSON.stringify(p.slice(-20))); } catch { /* rien */ } };

export interface EventStats { opened: number; claimed: number; themes: string[] }
export function eventStats(): EventStats {
  try { const v = JSON.parse(localStorage.getItem(STATS) || 'null'); if (v && typeof v.opened === 'number') return { opened: v.opened, claimed: v.claimed ?? 0, themes: Array.isArray(v.themes) ? v.themes : [] }; } catch { /* rien */ }
  return { opened: 0, claimed: 0, themes: [] };
}
function bumpStats(patch: Partial<{ opened: number; claimed: number; theme: string }>) {
  const s = eventStats();
  s.opened += patch.opened ?? 0;
  s.claimed += patch.claimed ?? 0;
  if (patch.theme && !s.themes.includes(patch.theme)) s.themes.push(patch.theme);
  try { localStorage.setItem(STATS, JSON.stringify(s)); } catch { /* rien */ }
  window.dispatchEvent(new CustomEvent('holocote:progress'));
}

/**
 * Tire un booster de l'événement (ou un booster bonus). Le tirage est enregistré tout de suite :
 * recharger la page ne permet pas de retenter sa chance.
 */
export async function openEventPack(useBonus = false): Promise<{ pack: EventPack; index: number; bonus: boolean } | null> {
  const ev = activeEvent();
  const theme = ev?.theme ?? nextEvent()?.theme ?? THEMES[0];
  if (!useBonus) {
    if (!ev || packsLeft(ev) <= 0) return null;
  } else if (bonusTickets() <= 0) return null;
  const drawn = await drawBooster({ save: false, setId: theme.setId });
  if (!drawn) return null;
  const pack: EventPack = { setId: theme.setId, cards: drawn.cards, revealed: false, claimed: false, bonus: useBonus || undefined, theme: theme.id };
  if (useBonus) {
    try { localStorage.setItem(BONUS, String(bonusTickets() - 1)); } catch { /* rien */ }
    const list = [...bonusPacks(), pack];
    writeBonusPacks(list);
    bumpStats({ opened: 1, theme: theme.id });
    return { pack, index: list.length - 1, bonus: true };
  }
  const st = readState(ev!.key);
  st.packs.push(pack);
  writeState(st);
  bumpStats({ opened: 1, theme: theme.id });
  return { pack, index: st.packs.length - 1, bonus: false };
}

export function updatePack(index: number, bonus: boolean, patch: Partial<EventPack>) {
  if (bonus) {
    const list = bonusPacks();
    if (!list[index]) return;
    list[index] = { ...list[index], ...patch };
    writeBonusPacks(list);
  } else {
    const ev = activeEvent();
    if (!ev) return;
    const st = readState(ev.key);
    if (!st.packs[index]) return;
    st.packs[index] = { ...st.packs[index], ...patch };
    writeState(st);
  }
  if (patch.claimed) bumpStats({ claimed: 1 });
}

/** « 1 j 04 h 12 min » */
export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 6e4));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return `${d ? `${d} j ` : ''}${String(h).padStart(2, '0')} h ${String(mm).padStart(2, '0')} min`;
}
