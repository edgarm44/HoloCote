// Succès : badges débloqués en jouant et en remplissant son classeur. Calculés à partir de ce que le
// navigateur garde déjà (classeur, favoris, journal du Défi, scans). Aucun gain réel, rien n'est envoyé.

import { getItems } from './collection';
import { countFavorites } from './favorites';
import { getLog, streak } from './progress';
import { rarityTier } from './rarity';
import { questDays } from './quests';
import { bestSetPct } from './sets';
import { eventStats } from './events';
import { stats as predStats, predictions } from './predict';
import { stats as intrusStats } from './intrus';
import { addCoins } from './wallet';

export type BadgeGroup = 'Classeur' | 'Défi' | 'Événements' | 'Quêtes' | 'Fidélité' | 'Explorer';
export interface Badge { id: string; group: BadgeGroup; name: string; hint: string; icon: string; got: boolean; progress?: [number, number]; reward: number; claimed: boolean }

const num = (k: string, f: (v: unknown) => number): number => {
  try { return f(JSON.parse(localStorage.getItem(k) || 'null')); } catch { return 0; }
};

export function computeBadges(): Badge[] {
  const items = getItems();
  const cards = items.length;
  const tiers = items.map((i) => rarityTier(i.rarity));
  const sets = new Set(items.map((i) => i.setName).filter(Boolean)).size;
  const log = Object.values(getLog());
  const st = streak();
  const mysteryWins = log.filter((l) => l.m === 'won').length;
  const firstTry = log.some((l) => l.m === 'won' && l.mt === 1);
  const boosters = log.filter((l) => l.b !== undefined).length;
  const bigHit = log.some((l) => (l.b ?? 0) >= 3);
  const duelWins = log.filter((l) => l.d === 'ok').length;
  const trainBest = num('holocote.duel.v1', (v) => (v as { best?: number })?.best ?? 0);
  const scans = num('holocote.scans.v1', (v) => (Array.isArray(v) ? v.length : 0));
  const favs = countFavorites();
  const qDays = questDays().length;
  let pseudo = '';
  try { pseudo = localStorage.getItem('holocote.pseudo.v1') || ''; } catch { /* rien */ }
  const fullDays = log.filter((l) => l.m && l.b !== undefined && l.d).length;
  const setPct = Math.round(bestSetPct() * 100);
  const evs = eventStats();
  const saved = num('holocote.backup.v1', (v) => (typeof v === 'number' && v > 0 ? 1 : 0));

  const pr = predStats();
  const predToday = predictions().length ? 1 : 0;
  const it = intrusStats();
  let theme = '';
  try { theme = localStorage.getItem('holocote.theme.v1') || ''; } catch { /* rien */ }
  const claimed = claimedIds();
  const B = (id: string, group: BadgeGroup, icon: string, name: string, hint: string, value: number, goal: number): Badge =>
    ({ id, group, icon, name, hint, got: value >= goal, progress: goal > 1 ? [Math.min(value, goal), goal] : undefined, reward: rewardFor(id, goal), claimed: claimed.includes(id) });

  return [
    B('c1', 'Classeur', '1', 'Première carte', 'Range ta première carte', cards, 1),
    B('c10', 'Classeur', '10', 'Petit classeur', '10 cartes différentes', cards, 10),
    B('c50', 'Classeur', '50', 'Grand classeur', '50 cartes différentes', cards, 50),
    B('c100', 'Classeur', '100', 'Collectionneur', '100 cartes différentes', cards, 100),
    B('rare', 'Classeur', 'R', 'Belle prise', 'Une carte rare ou mieux', tiers.filter((t) => t === 'rare' || t === 'ultra' || t === 'secret').length, 1),
    B('ultra', 'Classeur', 'UR', 'Ultra', 'Une carte ultra rare', tiers.filter((t) => t === 'ultra' || t === 'secret').length, 1),
    B('secret', 'Classeur', 'S', 'Pépite secrète', 'Une carte secrète', tiers.filter((t) => t === 'secret').length, 1),
    B('sets', 'Classeur', 'X', 'Globe-trotteur', 'Des cartes de 5 extensions', sets, 5),
    B('set10', 'Classeur', '10%', 'Bien parti', '10 % d’une extension au classeur', setPct, 10),
    B('set50', 'Classeur', '50%', 'À mi-chemin', 'La moitié d’une extension', setPct, 50),
    B('set100', 'Classeur', '100%', 'Complétiste', 'Une extension complète', setPct, 100),
    B('myst1', 'Défi', '?', 'Détective', 'Trouve une carte mystère', mysteryWins, 1),
    B('myst10', 'Défi', '??', 'Fin limier', '10 cartes mystère trouvées', mysteryWins, 10),
    B('lynx', 'Défi', '1er', 'Œil de lynx', 'Carte mystère trouvée au 1er essai', firstTry ? 1 : 0, 1),
    B('box1', 'Défi', 'B', 'Ouvreur', 'Ouvre ton premier booster du jour', boosters, 1),
    B('gold', 'Défi', 'B+', 'Main en or', 'Une carte secrète dans le booster du jour', bigHit ? 1 : 0, 1),
    B('duel1', 'Défi', 'VS', 'Duelliste', 'Gagne un duel du jour', duelWins, 1),
    B('duel10', 'Défi', 'VS+', 'Cote infaillible', '10 duels du jour gagnés', duelWins, 10),
    B('train', 'Défi', '10x', 'Acharné', 'Série de 10 en entraînement duel', trainBest, 10),
    B('ev1', 'Événements', 'EV', 'Première fête', 'Ouvre un booster événement', evs.opened, 1),
    B('ev10', 'Événements', 'EV+', 'Habitué des week-ends', '10 boosters événement ouverts', evs.opened, 10),
    B('ev3t', 'Événements', '3T', 'Globe-fêtard', 'Participe à 3 événements différents', evs.themes.length, 3),
    B('full', 'Défi', '3/3', 'Journée complète', 'Joue les 3 jeux le même jour', fullDays, 1),
    B('q1', 'Quêtes', 'Q', 'Aventurier', 'Termine les 3 quêtes d’un jour', qDays, 1),
    B('q7', 'Quêtes', 'Q7', 'Héros du quotidien', 'Quêtes terminées 7 jours', qDays, 7),
    B('q30', 'Quêtes', 'Q30', 'Légende', 'Quêtes terminées 30 jours', qDays, 30),
    B('s3', 'Fidélité', '3j', 'Régulier', '3 jours de Défi d’affilée', st.best, 3),
    B('s7', 'Fidélité', '7j', 'Fidèle', '7 jours de Défi d’affilée', st.best, 7),
    B('s30', 'Fidélité', '30j', 'Inarrêtable', '30 jours de Défi d’affilée', st.best, 30),
    B('pseudo', 'Explorer', '@', 'Enchanté', 'Choisis ton pseudo dans Compte', pseudo.trim() ? 1 : 0, 1),
    B('scan', 'Explorer', 'SC', 'Premier scan', 'Scanne une carte', scans, 1),
    B('fav', 'Explorer', '★', 'Fan', '5 cartes en favoris', favs, 5),
    B('save', 'Explorer', 'SV', 'Prévoyant', 'Sauvegarde ta progression dans Compte', saved, 1),
    B('c25', 'Classeur', '25', 'Classeur bien rempli', '25 cartes différentes', cards, 25),
    B('c250', 'Classeur', '250', 'Grand collectionneur', '250 cartes différentes', cards, 250),
    B('sets10', 'Classeur', 'XX', 'Explorateur d’extensions', 'Des cartes de 10 extensions', sets, 10),
    B('box10', 'Défi', 'B10', 'Habitué des boosters', '10 boosters du jour ouverts', boosters, 10),
    B('box30', 'Défi', 'B30', 'Ouvreur chevronné', '30 boosters du jour ouverts', boosters, 30),
    B('myst30', 'Défi', '30?', 'Grand détective', '30 cartes mystère trouvées', mysteryWins, 30),
    B('pred1', 'Défi', 'P', 'Voyant', 'Fais ta première prédiction', pr.played + predToday, 1),
    B('pred5', 'Défi', 'P5', 'Bon pronostic', '5 prédictions justes', pr.won, 5),
    B('pred3s', 'Défi', 'P3', 'Flair', '3 prédictions justes d’affilée', pr.best, 3),
    B('int1', 'Défi', 'IN', 'Œil d’expert', 'Trouve ton premier intrus', it.won, 1),
    B('int10', 'Défi', 'IN+', 'Pas dupe', '10 intrus trouvés', it.won, 10),
    B('int5s', 'Défi', 'IN5', 'Sans faute', '5 intrus trouvés d’affilée', it.best, 5),
    B('scan10', 'Explorer', 'S10', 'Scanner confirmé', 'Scanne 10 cartes', scans, 10),
    B('fav20', 'Explorer', '20★', 'Super fan', '20 cartes en favoris', favs, 20),
    B('ev25', 'Événements', 'E25', 'Fêtard', '25 boosters événement ouverts', evs.opened, 25),
    B('ev5t', 'Événements', '5T', 'Tour du monde', 'Participe à 5 événements différents', evs.themes.length, 5),
    B('palette', 'Explorer', 'TH', 'Changement de décor', 'Choisis un thème de couleur dans Compte', theme && theme !== 'neon' ? 1 : 0, 1),
  ];
}

const SEEN = 'holocote.badges.v1';

/** Badges débloqués depuis la dernière vérification (et les marque comme vus). */
export function newlyUnlocked(): Badge[] {
  const got = computeBadges().filter((b) => b.got);
  let seen: string[] | null = null;
  try { seen = JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch { /* rien */ }
  try { localStorage.setItem(SEEN, JSON.stringify(got.map((b) => b.id))); } catch { /* rien */ }
  if (!Array.isArray(seen)) return []; // première visite : on ne félicite pas pour l'existant
  return got.filter((b) => !seen!.includes(b.id));
}


/* ---------- Récompenses : des Éclats à récupérer pour chaque succès ---------- */
const CLAIM = 'holocote.badgeclaim.v1';
const BIG = new Set(['set100', 'q30', 's30', 'c250', 'myst30', 'ev25']);
/** Éclats offerts : plus le succès est difficile, plus c'est généreux. */
export function rewardFor(id: string, goal: number): number {
  if (BIG.has(id)) return 150;
  if (goal >= 100) return 100;
  if (goal >= 30) return 80;
  if (goal >= 10) return 50;
  if (goal >= 3) return 30;
  return 20;
}
function claimedIds(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CLAIM) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
/** Récupère les Éclats d'un succès débloqué (une seule fois). Renvoie le nombre d'Éclats gagnés. */
export function claimBadge(id: string): number {
  const b = computeBadges().find((x) => x.id === id);
  if (!b || !b.got || b.claimed) return 0;
  try { localStorage.setItem(CLAIM, JSON.stringify([...claimedIds(), id])); } catch { return 0; }
  addCoins(b.reward, `Succès : ${b.name}`);
  return b.reward;
}
export function claimAllBadges(): number {
  const ids = computeBadges().filter((b) => b.got && !b.claimed).map((b) => b.id);
  return ids.reduce((t, id) => t + claimBadge(id), 0);
}
export const unclaimedCount = () => computeBadges().filter((b) => b.got && !b.claimed).length;
