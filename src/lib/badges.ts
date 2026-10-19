// Succès : badges débloqués en jouant et en remplissant son classeur. Calculés à partir de ce que le
// navigateur garde déjà (classeur, favoris, journal du Défi, scans). Aucun gain réel, rien n'est envoyé.

import { getItems } from './collection';
import { countFavorites } from './favorites';
import { getLog, streak } from './progress';
import { rarityTier } from './rarity';
import { questDays } from './quests';
import { bestSetPct } from './sets';
import { eventOfDay } from './booster';

export type BadgeGroup = 'Classeur' | 'Défi' | 'Quêtes' | 'Fidélité' | 'Explorer';
export interface Badge { id: string; group: BadgeGroup; name: string; hint: string; icon: string; got: boolean; progress?: [number, number] }

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
  const retro = Object.entries(getLog()).filter(([n, l]) => l.b !== undefined && eventOfDay(Number(n))).length;
  const saved = num('holocote.backup.v1', (v) => (typeof v === 'number' && v > 0 ? 1 : 0));

  const B = (id: string, group: BadgeGroup, icon: string, name: string, hint: string, value: number, goal: number): Badge =>
    ({ id, group, icon, name, hint, got: value >= goal, progress: goal > 1 ? [Math.min(value, goal), goal] : undefined });

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
    B('retro', 'Défi', '99', 'Rétro', 'Ouvre un booster du Week-end rétro', retro, 1),
    B('retro4', 'Défi', '99+', 'Collectionneur d’époque', 'Ouvre 4 boosters rétro', retro, 4),
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
