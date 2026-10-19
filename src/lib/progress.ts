// Journal du Défi, jour par jour (navigateur uniquement) : série de jours joués et récap de la semaine.
// Un jour compte comme « joué » dès qu'un des trois jeux du jour a été joué (hors entraînement).

import { todayNumber, getDay } from './mystery';

export interface DayLog {
  m?: 'won' | 'lost';   // carte mystère terminée
  mt?: number;          // essais utilisés si trouvée
  b?: number;           // booster ouvert : niveau de la dernière carte (0 à 3)
  d?: 'ok' | 'ko';      // duel du jour
  cards?: number;       // cartes rangées dans le classeur ce jour-là
}
type Log = Record<string, DayLog>;
const KEY = 'holocote.days.v1';

function read(): Log {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

export function getLog(): Log {
  const log = read();
  // Les anciennes parties de carte mystère (avant ce journal) comptent aussi.
  try {
    const old = JSON.parse(localStorage.getItem('holocote.mystery.v1') || '{}') as Record<string, { won?: boolean; done?: boolean; guesses?: unknown[]; claimed?: boolean }>;
    for (const [n, r] of Object.entries(old)) {
      if (!r?.done || log[n]?.m) continue;
      log[n] = { ...log[n], m: r.won ? 'won' : 'lost', mt: r.won ? r.guesses?.length : undefined, cards: Math.max(log[n]?.cards ?? 0, r.claimed ? 1 : 0) };
    }
  } catch { /* rien */ }
  return log;
}

export function logDay(patch: Partial<DayLog>, n = todayNumber()) {
  const log = read();
  const cur = log[n] ?? {};
  const next: DayLog = { ...cur };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) (next as Record<string, unknown>)[k] = v;
  if (JSON.stringify(next) === JSON.stringify(cur)) return;
  log[n] = next;
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* rien */ }
  window.dispatchEvent(new CustomEvent('holocote:progress'));
}

/** Recopie l'état des trois jeux du jour dans le journal. */
export function syncToday(state: { boosterOpened: boolean; boosterClaimed: boolean; hit?: number; duel?: 'ok' | 'ko'; duelClaimed: boolean }) {
  const n = todayNumber();
  const m = getDay(n);
  const prev = read()[n] ?? {};
  logDay({
    m: m.done ? (m.won ? 'won' : 'lost') : undefined,
    mt: m.done && m.won ? m.guesses.length : undefined,
    // Avec les relances, plusieurs boosters par jour : on garde la meilleure dernière carte.
    b: state.boosterOpened ? Math.max(state.hit ?? 0, prev.b ?? 0) : undefined,
    d: state.duel,
    cards: (m.claimed ? 1 : 0) + (state.boosterClaimed ? 1 : 0) + (state.duelClaimed ? 1 : 0) || undefined,
  }, n);
}

export const played = (l?: DayLog) => !!l && (!!l.m || l.b !== undefined || !!l.d);

function runEnding(log: Log, n: number): number {
  let k = 0;
  while (played(log[n - k])) k++;
  return k;
}

export interface Streak { current: number; best: number; playedToday: boolean; boostToday: boolean; nextBoostIn: number }

export function streak(today = todayNumber()): Streak {
  const log = getLog();
  const playedToday = played(log[today]);
  const before = runEnding(log, today - 1);
  const current = playedToday ? before + 1 : before;
  let best = 0, run = 0, prev = -2;
  for (const n of Object.keys(log).map(Number).filter((x) => played(log[x])).sort((a, b) => a - b)) {
    run = n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  // Bonus : le 7ᵉ, 14ᵉ, 21ᵉ... jour d'affilée, le booster du jour est boosté.
  const todayRank = before + 1;
  return { current, best: Math.max(best, current), playedToday, boostToday: todayRank % 7 === 0, nextBoostIn: (7 - (todayRank % 7)) % 7 };
}

export interface WeekDay { n: number; date: Date; log: DayLog }

/** Les 7 derniers jours, du plus ancien à aujourd'hui. */
export function week(today = todayNumber()): WeekDay[] {
  const log = getLog();
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    return { n: today - back, date, log: log[today - back] ?? {} };
  });
}
