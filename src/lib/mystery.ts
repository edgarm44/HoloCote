// « Carte mystère du jour » : une carte par jour, la même pour tout le monde, à deviner en 6 essais.
// Tout se passe dans le navigateur ; les parties sont gardées dans le stockage local.
// Identifiants vérifiés dans la base TCGdex (copie du 3 octobre 2026). La réponse est le nom du Pokémon.

import { normalize, similarity } from './cardindex';
import { phonetic } from './smartsearch';

const RAW = `base1-4:Dracaufeu base1-2:Tortank base1-15:Florizarre base1-10:Mewtwo base1-58:Pikachu base1-16:Électhor
base1-1:Alakazam base1-6:Léviator base1-44:Bulbizarre base1-46:Salamèche base1-63:Carapuce sv03.5-166:Bulbizarre
sv03.5-167:Herbizarre sv03.5-168:Salamèche sv03.5-169:Reptincel sv03.5-170:Carapuce sv03.5-171:Carabaffe sv03.5-172:Chenipan
sv03.5-173:Pikachu sv03.5-174:Nidoking sv03.5-175:Psykokwak sv03.5-176:Têtarte sv03.5-177:Machopeur sv03.5-178:Saquedeneu
sv03.5-179:M._Mime sv03.5-199:Dracaufeu sv03.5-200:Tortank sv03.5-198:Florizarre sv03.5-205:Mew swsh7-215:Noctali
swsh7-218:Rayquaza swsh7-212:Nymphali swsh8-269:Mew swsh8-271:Ectoplasma swsh11-186:Giratina swsh12-186:Lugia
swsh4-188:Pikachu sv01-245:Gardevoir sv02-256:Miascarade sv06-214:Amphinobi sv06-216:Ursaking sv06.5-093:Pêchaminus
sv08.5-167:Évoli sv08.5-156:Nymphali sv08.5-155:Mentali sv08.5-161:Noctali sv08-238:Pikachu me01-179:Lucario
me01-177:Florizarre me01-187:Gardevoir me02-130:Dracaufeu me02.5-284:Ectoplasma me03-121:Miaouss me04-116:Amphinobi
me05-116:Darkrai me03-124:Zygarde sv09-185:Zoroark sv10-231:Mewtwo sv10.5b-166:Zekrom sv10.5w-166:Reshiram
30th-150:Pikachu 30th-152:Mew 30th-154:Ectoplasma 30th-153:Nymphali sv07-148:Carapuce sv07-143:Bulbizarre
sv08-203:Latios sv06.5-075:Zorua me01-133:Bulbizarre me01-138:Goupix me02-106:Miaouss me02-098:Tiplouf
me03-090:Brindibou me02-100:Zacian`;

export interface MysteryCard { id: string; answer: string }
export const POOL: MysteryCard[] = RAW.split(/\s+/).filter(Boolean).map((t) => {
  const [id, a] = t.split(':');
  return { id, answer: a.replace(/_/g, ' ') };
});
/** Noms proposés quand l'index complet n'est pas disponible. */
export const POOL_NAMES = [...new Set(POOL.map((p) => p.answer))].sort((a, b) => a.localeCompare(b, 'fr'));

const NEIGHBOURS = 'Latias Raichu Pichu Mewtwo Mew Kyurem Zamazenta Zarude Kyogre Groudon Ho-Oh Rattata Rattatac Feunard Persian Nidoqueen Nidorino Psykokwak Akwakwak Têtarte Têtampoule Tartard Herbizarre Reptincel Carabaffe Darkrai Cresselia Lucario Riolu Gardevoir Gallame Amphinobi Grenousse Croâporal Miascarade Matourgeon Poussacha Mentali Pyroli Aquali Voltali Phyllali Givrali Nymphali Noctali Évoli Zorua Zoroark Machoc Machopeur Mackogneur';
const KNOWN = new Set([...POOL.map((p) => p.answer), ...NEIGHBOURS.split(' ')].map((n) => normalize(n)));

export const MAX_TRIES = 6;
const EPOCH = Date.UTC(2026, 9, 18); // n° 1 = 18 octobre 2026

/** Date du jour à Paris (la carte change à minuit, heure française). */
function parisParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
}
export function todayNumber(d = new Date()): number {
  const p = parisParts(d);
  return Math.floor((Date.UTC(p.y, p.m - 1, p.d) - EPOCH) / 864e5) + 1;
}
export function msToMidnight(d = new Date()): number {
  const p = parisParts(d);
  return ((23 - p.h) * 3600 + (59 - p.mi) * 60 + (60 - p.s)) * 1000;
}

/** Mélange fixe (le même pour tout le monde) : on parcourt toute la liste avant de revoir une carte. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ORDER = (() => {
  const a = POOL.map((_, i) => i);
  const r = seeded(20261018);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
})();
export function cardOfDay(n: number): MysteryCard {
  const k = ((n - 1) % ORDER.length + ORDER.length) % ORDER.length;
  return POOL[ORDER[k]];
}
export function randomCard(exclude?: string): MysteryCard {
  const list = POOL.filter((p) => p.id !== exclude);
  return list[Math.floor(Math.random() * list.length)];
}

/** Nom d'espèce à partir d'un nom de carte (« Méga-Dracaufeu X-ex » donne « Dracaufeu »). */
export function species(name: string): string {
  return name
    .replace(/^Méga-/, '')
    .replace(/-ex\b.*$/, '')
    .replace(/\s(VMAX|VSTAR|V|GX|EX)\b.*$/, '')
    .replace(/\s[XY]$/, '')
    .replace(/\s(de|d')\s.*$/, '')
    .trim();
}

/** La proposition est-elle la bonne réponse ? Les petites fautes sont tolérées. */
export function isRight(guess: string, answer: string): boolean {
  const g = normalize(species(guess) || guess), a = normalize(answer);
  if (!g) return false;
  if (g === a) return true;
  // Le nom exact d'un autre Pokémon n'est jamais accepté (Latias n'est pas Latios).
  if (KNOWN.has(g)) return false;
  if (phonetic(g) === phonetic(a)) return true;
  if (a.length < 5) return false;
  const tol = a.length >= 8 ? 2 : 1; // une faute (deux pour les noms longs)
  return damerau(g, a) <= tol || damerau(phonetic(g), phonetic(a)) <= tol - 1 || similarity(g, a) >= 0.9;
}

/** Distance d'édition avec inversion de deux lettres voisines. */
function damerau(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const TYPES_FR: Record<string, string> = {
  Fire: 'Feu', Water: 'Eau', Grass: 'Plante', Lightning: 'Électrique', Psychic: 'Psy', Fighting: 'Combat',
  Darkness: 'Obscurité', Metal: 'Métal', Dragon: 'Dragon', Colorless: 'Incolore', Fairy: 'Fée',
};
export const typeFr = (t: string) => TYPES_FR[t] ?? t;

/* Parties enregistrées */
export interface DayRecord { guesses: string[]; won: boolean; done: boolean }
const KEY = 'holocote.mystery.v1';
type Store = Record<string, DayRecord>;
function read(): Store {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function getDay(n: number): DayRecord {
  return read()[n] ?? { guesses: [], won: false, done: false };
}
export function saveDay(n: number, r: DayRecord) {
  const s = read();
  s[n] = r;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* rien */ }
}

export interface Stats { played: number; wins: number; streak: number; best: number; dist: number[] }
export function stats(today: number): Stats {
  const s = read();
  const days = Object.keys(s).map(Number).filter((n) => s[n].done).sort((a, b) => a - b);
  const dist = new Array(MAX_TRIES).fill(0);
  let wins = 0, best = 0, run = 0, prev = -1;
  for (const n of days) {
    const r = s[n];
    if (r.won) { wins++; dist[Math.min(MAX_TRIES, r.guesses.length) - 1]++; run = prev === n - 1 ? run + 1 : 1; best = Math.max(best, run); }
    else run = 0;
    prev = n;
  }
  // La série en cours compte si la dernière victoire date d'aujourd'hui ou d'hier.
  const last = days[days.length - 1];
  const streak = last !== undefined && s[last].won && last >= today - 1 ? run : 0;
  return { played: days.length, wins, streak, best, dist };
}
