// Personnage du joueur : Coti personnalisé (couleur, accessoire, aura), débloqués en montant de niveau.
// Dessin 100 % original. Tout est gardé dans le navigateur.

import { faceParts, type Mood } from './mascot';

export interface Item { id: string; name: string; lvl: number }
export interface Palette extends Item { stops: string[]; feet: string; spin?: boolean }

export const PALETTES: Palette[] = [
  { id: 'holo', name: 'Holo', lvl: 1, stops: ['#3ef0ff', '#8a7bff', '#ff4fd8', '#ffd25a'], feet: '#8a7bff' },
  { id: 'ocean', name: 'Océan', lvl: 2, stops: ['#7fe7ff', '#2f8cff', '#2a4bd6', '#3ef0ff'], feet: '#2a4bd6' },
  { id: 'feu', name: 'Braise', lvl: 4, stops: ['#ffd25a', '#ff8a3d', '#ff3d6e', '#ffb36b'], feet: '#e0354f' },
  { id: 'foret', name: 'Forêt', lvl: 6, stops: ['#e6ff9c', '#3dffa8', '#14a37f', '#b8ff6a'], feet: '#14a37f' },
  { id: 'nuit', name: 'Minuit', lvl: 9, stops: ['#8a7bff', '#4b2fb8', '#1b1446', '#ff4fd8'], feet: '#2b1f6e' },
  { id: 'glace', name: 'Glace', lvl: 11, stops: ['#ffffff', '#9fe8ff', '#5cc8ff', '#e9fbff'], feet: '#3aa6e0' },
  { id: 'or', name: 'Or massif', lvl: 13, stops: ['#fff3b0', '#ffd25a', '#d99a1e', '#fff1c2'], feet: '#b67d10' },
  { id: 'sakura', name: 'Sakura', lvl: 16, stops: ['#fff0f6', '#ff9cc8', '#ff5fa2', '#ffe3f0'], feet: '#e2468a' },
  { id: 'prisme', name: 'Prisme', lvl: 20, stops: ['#ff4f6d', '#ffd25a', '#3dffa8', '#3ef0ff', '#8a7bff', '#ff4fd8'], feet: '#8a7bff', spin: true },
  { id: 'lave', name: 'Lave', lvl: 25, stops: ['#ffd25a', '#ff3d00', '#5a0f0f', '#ff8a3d'], feet: '#5a0f0f', spin: true },
  { id: 'diamant', name: 'Diamant', lvl: 40, stops: ['#ffffff', '#bfe9ff', '#e6d4ff', '#ffffff', '#c8fff0'], feet: '#8fa8ff', spin: true },
];
export const ACCESSORIES: Item[] = [
  { id: 'none', name: 'Aucun', lvl: 1 },
  { id: 'cap', name: 'Casquette', lvl: 3 },
  { id: 'glasses', name: 'Lunettes', lvl: 5 },
  { id: 'scarf', name: 'Écharpe', lvl: 7 },
  { id: 'phones', name: 'Casque audio', lvl: 10 },
  { id: 'bandana', name: 'Bandana', lvl: 12 },
  { id: 'crown', name: 'Couronne', lvl: 15 },
  { id: 'halo', name: 'Auréole', lvl: 18 },
  { id: 'wizard', name: 'Chapeau de mage', lvl: 22 },
  { id: 'mask', name: 'Masque de héros', lvl: 26 },
  { id: 'tophat', name: 'Haut-de-forme', lvl: 30 },
];
export const AURAS: Item[] = [
  { id: 'none', name: 'Aucune', lvl: 1 },
  { id: 'sparkle', name: 'Étincelles', lvl: 2 },
  { id: 'glow', name: 'Halo', lvl: 8 },
  { id: 'flame', name: 'Flammes', lvl: 12 },
  { id: 'galaxy', name: 'Galaxie', lvl: 16 },
  { id: 'thunder', name: 'Foudre', lvl: 21 },
  { id: 'rainbow', name: 'Arc-en-ciel', lvl: 28 },
  { id: 'petals', name: 'Pétales', lvl: 34 },
];
export const POSES: Item[] = [
  { id: 'wave', name: 'Salut', lvl: 1 },
  { id: 'cheer', name: 'Victoire', lvl: 4 },
  { id: 'hips', name: 'Fier', lvl: 9 },
  { id: 'point', name: 'Champion', lvl: 14 },
];
export const BACKGROUNDS: Item[] = [
  { id: 'none', name: 'Aucun', lvl: 1 },
  { id: 'stars', name: 'Nuit étoilée', lvl: 3 },
  { id: 'beach', name: 'Plage', lvl: 6 },
  { id: 'forest', name: 'Sous-bois', lvl: 11 },
  { id: 'arena', name: 'Arène', lvl: 17 },
  { id: 'space', name: 'Cosmos', lvl: 24 },
  { id: 'aurora', name: 'Aurore', lvl: 32 },
];
export const PETS: Item[] = [
  { id: 'none', name: 'Aucun', lvl: 1 },
  { id: 'orb', name: 'Feu follet', lvl: 5 },
  { id: 'minicard', name: 'Mini-carte', lvl: 8 },
  { id: 'bubble', name: 'Bulle', lvl: 13 },
  { id: 'robot', name: 'Robot', lvl: 19 },
  { id: 'dragon', name: 'Dragonnet', lvl: 27 },
  { id: 'comet', name: 'Comète', lvl: 36 },
];
export const MOODS: Mood[] = ['happy', 'wink', 'wow', 'think', 'sad'];

export interface Look { palette: string; acc: string; aura: string; pose: string; bg: string; pet: string }
const DEFAULT: Look = { palette: 'holo', acc: 'none', aura: 'none', pose: 'wave', bg: 'none', pet: 'none' };
export const SLOTS: { key: keyof Look; label: string; list: Item[] }[] = [];
const LOOK = 'holocote.look.v1';
const MOOD = 'holocote.avatar.v1';

const unlocked = (list: Item[], id: string, level: number) => list.some((x) => x.id === id && x.lvl <= level);

const LISTS: Record<keyof Look, Item[]> = { palette: PALETTES, acc: ACCESSORIES, aura: AURAS, pose: POSES, bg: BACKGROUNDS, pet: PETS };
SLOTS.push(
  { key: 'pose', label: 'Pose', list: POSES },
  { key: 'palette', label: 'Couleur', list: PALETTES },
  { key: 'acc', label: 'Accessoire', list: ACCESSORIES },
  { key: 'aura', label: 'Aura', list: AURAS },
  { key: 'bg', label: 'Fond', list: BACKGROUNDS },
  { key: 'pet', label: 'Compagnon', list: PETS },
);
function sanitize(raw: Partial<Look>, level: number): Look {
  const out = { ...DEFAULT };
  for (const k of Object.keys(LISTS) as (keyof Look)[]) {
    const v = raw[k];
    if (typeof v === 'string' && unlocked(LISTS[k], v, level)) out[k] = v;
  }
  return out;
}
export function getLook(level = 99): Look {
  let raw: Partial<Look> = {};
  try { raw = JSON.parse(localStorage.getItem(LOOK) || '{}') ?? {}; } catch { /* rien */ }
  return sanitize(raw, level);
}
export function setLook(look: Look, level: number) {
  try { localStorage.setItem(LOOK, JSON.stringify(sanitize(look, level))); } catch { /* rien */ }
}
export function getMood(): Mood {
  try { const m = localStorage.getItem(MOOD) as Mood; return MOODS.includes(m) ? m : 'happy'; } catch { return 'happy'; }
}

const KIND: Record<keyof Look, [string, string]> = { palette: ['couleur', 'la couleur'], acc: ['accessoire', "l'accessoire"], aura: ['aura', "l'aura"], pose: ['pose', 'la pose'], bg: ['fond', 'le fond'], pet: ['compagnon', 'le compagnon'] };
const allItems = () => (Object.keys(LISTS) as (keyof Look)[]).flatMap((k) => LISTS[k].filter((x) => x.lvl > 1).map((x) => ({ ...x, k })));
/** Objets débloqués exactement à ce niveau (pour l'annonce de passage de niveau). */
export function unlocksAt(level: number): string[] {
  return allItems().filter((x) => x.lvl === level).map((x) => `${KIND[x.k][0]} ${x.name}`);
}
/** Prochain objet à débloquer après ce niveau. */
export function nextUnlock(level: number): { lvl: number; label: string } | null {
  const n = allItems().filter((x) => x.lvl > level).sort((a, b) => a.lvl - b.lvl)[0];
  return n ? { lvl: n.lvl, label: `${KIND[n.k][1]} ${n.name}` } : null;
}

/* ---------- Dessin ---------- */
let uid = 0;

function auraSvg(aura: string, id: string, p: Palette): string {
  switch (aura) {
    case 'sparkle': {
      const star = (x: number, y: number, r: number, c: string, d: number) =>
        `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z" fill="${c}"><animate attributeName="opacity" values="1;.25;1" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></path>`;
      return star(0, 30, 7, '#ffd25a', 0) + star(126, 46, 6, '#3ef0ff', 0.6) + star(-4, 110, 5, '#ff4fd8', 1.2) + star(128, 118, 7, '#fff', 0.3) + star(112, 2, 4, '#fff', 1.6);
    }
    case 'glow':
      return `<defs><radialGradient id="${id}a"><stop offset="0" stop-color="${p.stops[1]}" stop-opacity=".75"/><stop offset=".6" stop-color="${p.stops[2]}" stop-opacity=".25"/><stop offset="1" stop-color="${p.stops[2]}" stop-opacity="0"/></radialGradient></defs>
        <circle cx="62" cy="74" r="78" fill="url(#${id}a)"><animate attributeName="r" values="72;80;72" dur="3.2s" repeatCount="indefinite"/></circle>`;
    case 'flame': {
      const tongue = (x: number, h: number, d: number) =>
        `<path d="M${x - 13} 148 Q${x - 22} ${148 - h * 0.55} ${x} ${148 - h} Q${x + 3} ${148 - h * 0.62} ${x + 9} ${148 - h * 0.58} Q${x + 22} ${148 - h * 0.3} ${x + 13} 148Z">
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="${0.9 + d}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="1;.65;1" dur="${0.9 + d}s" repeatCount="indefinite"/></path>`;
      return `<defs><linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d6e" stop-opacity=".1"/><stop offset=".22" stop-color="#ff3d6e"/><stop offset=".6" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ffd25a"/></linearGradient>
        <radialGradient id="${id}fg" cx=".5" cy=".85"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff3d6e" stop-opacity="0"/></radialGradient></defs>
        <ellipse cx="62" cy="120" rx="80" ry="54" fill="url(#${id}fg)"/>
        <g fill="url(#${id}f)">${tongue(2, 72, 0.1)}${tongue(20, 104, 0.3)}${tongue(62, 150, 0.2)}${tongue(104, 108, 0)}${tongue(122, 76, 0.25)}</g>`;
    }
    case 'galaxy': {
      const dots = [[8, 40], [118, 30], [128, 96], [-2, 92], [20, 140], [104, 146], [60, -6], [130, 60], [-6, 64]]
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.6 : 2.6}" fill="#fff"><animate attributeName="opacity" values="1;.3;1" dur="${2 + (i % 3)}s" repeatCount="indefinite"/></circle>`).join('');
      return `<defs><radialGradient id="${id}x"><stop offset="0" stop-color="#5a3dd6" stop-opacity=".9"/><stop offset=".7" stop-color="#1b1446" stop-opacity=".85"/><stop offset="1" stop-color="#07060d" stop-opacity="0"/></radialGradient></defs>
        <circle cx="62" cy="74" r="80" fill="url(#${id}x)"/>
        <ellipse cx="62" cy="74" rx="78" ry="22" fill="none" stroke="#8a7bff" stroke-opacity=".6" stroke-width="2" transform="rotate(-18 62 74)"/>${dots}`;
    }
    case 'thunder': {
      const bolt = (x: number, y: number, flip: number, d: number) => `<path transform="translate(${x} ${y}) scale(${flip} 1)" d="M0 0 L-10 22 L-2 22 L-8 44 L12 16 L3 16 L10 0Z" fill="#ffe14d" stroke="#fff6b0" stroke-width="1.5"><animate attributeName="opacity" values="1;.2;1;1;.4;1" dur="1.6s" begin="${d}s" repeatCount="indefinite"/></path>`;
      return `<circle cx="62" cy="74" r="74" fill="#ffe14d" opacity=".08"/>${bolt(2, 20, 1, 0)}${bolt(124, 60, -1, 0.5)}${bolt(-2, 92, 1, 0.9)}${bolt(128, 2, -1, 1.2)}`;
    }
    case 'rainbow': {
      const cols = ['#ff4f6d', '#ff8a3d', '#ffd25a', '#3dffa8', '#3ef0ff', '#8a7bff'];
      return `<g fill="none" stroke-width="5" opacity=".75">${cols.map((c, i) => `<path d="M${-8 + i * 6} 120 A${70 - i * 6} ${70 - i * 6} 0 0 1 ${132 - i * 6} 120" stroke="${c}"/>`).join('')}</g>`;
    }
    case 'petals': {
      const petal = (x: number, y: number, r: number, d: number) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#ff9cc8" transform="rotate(${r} ${x} ${y})"><animateTransform attributeName="transform" type="translate" values="0 -6;6 10;0 -6" dur="${3 + d}s" additive="sum" repeatCount="indefinite"/></ellipse>`;
      return [[2, 20, 30, 0], [120, 30, -20, 0.6], [-6, 80, 60, 1.1], [130, 96, 10, 0.3], [16, 132, -40, 0.9], [110, 140, 50, 1.4], [62, -8, 15, 0.5]].map(([x, y, r, d]) => petal(x, y, r, d)).join('');
    }
    default: return '';
  }
}

function accSvg(acc: string, id: string): string {
  switch (acc) {
    case 'cap':
      return `<path d="M24 28 q38 -34 76 0 z" fill="#ff4f6d" stroke="#f1effa" stroke-width="3" stroke-linejoin="round"/>
        <path d="M62 8 v20" stroke="#c9304f" stroke-width="2.5"/><circle cx="62" cy="9" r="3.4" fill="#f1effa"/>
        <path d="M70 27 q26 -6 46 4 q-4 6 -14 6 q-14 -2 -32 -2z" fill="#c9304f" stroke="#f1effa" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'glasses':
      return `<g stroke="#0b0918" stroke-width="3.2" stroke-linejoin="round">
        <rect x="38" y="54" width="24" height="19" rx="7" fill="#3ef0ff" fill-opacity=".28"/>
        <rect x="62" y="54" width="24" height="19" rx="7" fill="#ff4fd8" fill-opacity=".28"/>
        <path d="M30 60 h8 M86 60 h8" fill="none"/></g>
        <path d="M42 58 l6 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M66 58 l6 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
    case 'scarf':
      return `<path d="M22 100 q40 16 80 0 v12 q-40 16 -80 0z" fill="#ffd25a" stroke="#f1effa" stroke-width="2.5"/>
        <path d="M30 104 q32 12 64 0" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-dasharray="6 6"/>
        <path d="M80 110 l14 30 -12 -1 -10 -24z" fill="#ffd25a" stroke="#f1effa" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'phones':
      return `<path d="M14 70 q0 -66 48 -66 q48 0 48 66" fill="none" stroke="#1b1730" stroke-width="8" stroke-linecap="round"/>
        <path d="M14 70 q0 -66 48 -66 q48 0 48 66" fill="none" stroke="#3ef0ff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
        <rect x="4" y="56" width="18" height="30" rx="8" fill="#1b1730" stroke="#3ef0ff" stroke-width="2.5"/>
        <rect x="102" y="56" width="18" height="30" rx="8" fill="#1b1730" stroke="#ff4fd8" stroke-width="2.5"/>`;
    case 'crown':
      return `<defs><linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#d99a1e"/></linearGradient></defs>
        <path d="M36 26 l4 -22 12 12 10 -18 10 18 12 -12 4 22z" fill="url(#${id}c)" stroke="#fff3b0" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="62" cy="16" r="3.6" fill="#ff4fd8"/><circle cx="46" cy="20" r="2.6" fill="#3ef0ff"/><circle cx="78" cy="20" r="2.6" fill="#3dffa8"/>`;
    case 'halo':
      return `<ellipse cx="62" cy="4" rx="28" ry="7" fill="none" stroke="#ffd25a" stroke-width="4.5"><animate attributeName="cy" values="4;0;4" dur="2.6s" repeatCount="indefinite"/></ellipse>
        <ellipse cx="62" cy="4" rx="28" ry="7" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"><animate attributeName="cy" values="4;0;4" dur="2.6s" repeatCount="indefinite"/></ellipse>`;
    case 'bandana':
      return `<path d="M20 30 q42 -8 84 0 v9 q-42 -8 -84 0z" fill="#ff4f6d" stroke="#f1effa" stroke-width="2"/>
        <circle cx="34" cy="33" r="1.6" fill="#fff"/><circle cx="52" cy="31" r="1.6" fill="#fff"/><circle cx="72" cy="31" r="1.6" fill="#fff"/><circle cx="90" cy="33" r="1.6" fill="#fff"/>
        <path d="M102 32 l16 -6 -4 10 6 6 -16 -2z" fill="#ff4f6d" stroke="#f1effa" stroke-width="2" stroke-linejoin="round"/>`;
    case 'wizard':
      return `<path d="M32 28 L66 -16 L92 28 Z" fill="#4b2fb8" stroke="#f1effa" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M60 6 l2 4 4 1 -4 2 -2 4 -2 -4 -4 -2 4 -1z" fill="#ffd25a"/><circle cx="74" cy="16" r="2" fill="#3ef0ff"/><circle cx="52" cy="20" r="1.6" fill="#ff4fd8"/>
        <ellipse cx="62" cy="28" rx="38" ry="6" fill="#3a2391" stroke="#f1effa" stroke-width="2.5"/>`;
    case 'mask':
      return `<path d="M30 58 q32 -12 64 0 v12 q-32 10 -64 0z" fill="#ff3d6e" stroke="#0b0918" stroke-width="2.5"/>
        <path d="M94 62 l14 -6 -4 8 6 4 -16 2z" fill="#ff3d6e" stroke="#0b0918" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="50" cy="64" rx="8" ry="5.5" fill="#f8f6ff"/><ellipse cx="74" cy="64" rx="8" ry="5.5" fill="#f8f6ff"/>
        <circle cx="50" cy="64" r="3.4" fill="#0b0918"/><circle cx="74" cy="64" r="3.4" fill="#0b0918"/>`;
    case 'tophat':
      return `<rect x="40" y="-10" width="44" height="34" rx="4" fill="#1b1730" stroke="#f1effa" stroke-width="2.5"/>
        <rect x="40" y="12" width="44" height="7" fill="#ff4fd8"/>
        <ellipse cx="62" cy="25" rx="36" ry="6" fill="#1b1730" stroke="#f1effa" stroke-width="2.5"/>
        <path d="M46 -4 v12" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`;
    default: return '';
  }
}

/* Fonds : un décor arrondi derrière le personnage. */
function bgSvg(bg: string, id: string): string {
  if (bg === 'none') return '';
  const frame = (fill: string, inner = '') => `<clipPath id="${id}bc"><rect x="-14" y="-16" width="152" height="176" rx="26"/></clipPath>
    <g clip-path="url(#${id}bc)"><rect x="-14" y="-16" width="152" height="176" fill="${fill}"/>${inner}</g>`;
  const grad = (a: string, b: string) => `<defs><linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
  const stars = (n: number, seed: number) => Array.from({ length: n }, (_, i) => { const x = -10 + ((i * 53 + seed * 17) % 144), y = -12 + ((i * 37 + seed * 29) % 120); return `<circle cx="${x}" cy="${y}" r="${i % 4 ? 0.9 : 1.6}" fill="#fff" opacity="${0.5 + (i % 3) * 0.2}"/>`; }).join('');
  switch (bg) {
    case 'stars': return grad('#241b5e', '#0b0920') + frame(`url(#${id}bg)`, `${stars(22, 1)}<path d="M120 -2 a12 12 0 1 0 8 20 a10 10 0 1 1 -8 -20z" fill="#fff3b0"/>`);
    case 'beach': return grad('#7fe7ff', '#ffd9a8') + frame(`url(#${id}bg)`, `<circle cx="112" cy="8" r="14" fill="#ffd25a"/><path d="M-14 104 q38 -8 76 0 t76 0 v20 h-152z" fill="#2f8cff"/><path d="M-14 116 q38 -6 76 0 t76 0" fill="none" stroke="#bff3ff" stroke-width="2"/><rect x="-14" y="124" width="152" height="40" fill="#f3d29b"/><path d="M-8 8 q8 -6 16 0 q8 -6 16 0" fill="none" stroke="#fff" stroke-width="2"/>`);
    case 'forest': return grad('#1d5a42', '#0b1f18') + frame(`url(#${id}bg)`, `<path d="M-14 160 L4 70 L22 160Z M100 160 L120 60 L140 160Z M-6 160 L14 100 L34 160Z" fill="#0f3a2a"/><path d="M84 160 L104 96 L124 160Z" fill="#134832"/>${[[10, 40], [100, 30], [30, 120], [110, 110], [60, -4]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#e6ff9c"><animate attributeName="opacity" values="1;.2;1" dur="${2 + i * 0.4}s" repeatCount="indefinite"/></circle>`).join('')}`);
    case 'arena': return grad('#3a1a66', '#120b26') + frame(`url(#${id}bg)`, `<path d="M10 -16 L-14 150 L40 150Z M114 -16 L84 150 L138 150Z" fill="#fff" opacity=".07"/><ellipse cx="62" cy="150" rx="80" ry="20" fill="#2a1446" stroke="#ff4fd8" stroke-opacity=".6" stroke-width="2"/><ellipse cx="62" cy="150" rx="40" ry="9" fill="none" stroke="#3ef0ff" stroke-opacity=".5" stroke-width="2"/>`);
    case 'space': return grad('#120a2e', '#000') + frame(`url(#${id}bg)`, `${stars(30, 3)}<circle cx="112" cy="14" r="14" fill="#ff8a3d"/><ellipse cx="112" cy="14" rx="24" ry="6" fill="none" stroke="#ffd25a" stroke-width="2.5" transform="rotate(-20 112 14)"/><circle cx="4" cy="128" r="6" fill="#3ef0ff" opacity=".7"/>`);
    case 'aurora': return grad('#071a2a', '#030a12') + frame(`url(#${id}bg)`, `${stars(16, 5)}<g fill="none" stroke-width="14" opacity=".45" stroke-linecap="round"><path d="M-20 30 q40 -30 80 0 t80 -6" stroke="#3dffa8"><animate attributeName="d" values="M-20 30 q40 -30 80 0 t80 -6;M-20 24 q40 -20 80 6 t80 -12;M-20 30 q40 -30 80 0 t80 -6" dur="6s" repeatCount="indefinite"/></path><path d="M-20 50 q40 -26 80 0 t80 -4" stroke="#3ef0ff"/><path d="M-20 68 q40 -22 80 0 t80 -2" stroke="#ff4fd8" opacity=".6"/></g>`);
    default: return '';
  }
}

/* Compagnons : petits personnages originaux à côté du joueur. */
function petSvg(pet: string, id: string): string {
  const bob = (inner: string, dur = 2.4) => `<g>${inner}<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="${dur}s" repeatCount="indefinite"/></g>`;
  switch (pet) {
    case 'orb': return `<defs><radialGradient id="${id}o"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#3ef0ff"/><stop offset="1" stop-color="#3ef0ff" stop-opacity="0"/></radialGradient></defs>` + bob(`<circle cx="122" cy="112" r="16" fill="url(#${id}o)"/><circle cx="118" cy="110" r="1.6" fill="#0b0918"/><circle cx="125" cy="110" r="1.6" fill="#0b0918"/>`);
    case 'minicard': return bob(`<rect x="110" y="106" width="22" height="30" rx="4" fill="url(#${id}g)" stroke="#f1effa" stroke-width="2"/><rect x="113" y="111" width="16" height="13" rx="3" fill="#f8f6ff"/><circle cx="118" cy="117" r="1.5" fill="#0b0918"/><circle cx="124" cy="117" r="1.5" fill="#0b0918"/><path d="M118 121 q3 2 6 0" stroke="#0b0918" stroke-width="1.3" fill="none"/><circle cx="116" cy="139" r="3" fill="#f1effa"/><circle cx="126" cy="139" r="3" fill="#f1effa"/>`, 1.8);
    case 'bubble': return bob(`<circle cx="122" cy="114" r="13" fill="#7fe7ff" fill-opacity=".18" stroke="#bff3ff" stroke-width="2"/><path d="M114 108 a9 9 0 0 1 8 -5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="118" cy="116" r="1.6" fill="#0b0918"/><circle cx="126" cy="116" r="1.6" fill="#0b0918"/>`, 3);
    case 'robot': return `<path d="M121 98 v-6" stroke="#b8c0d8" stroke-width="2"/><circle cx="121" cy="91" r="2.6" fill="#ff4f6d"><animate attributeName="opacity" values="1;.2;1" dur="1.2s" repeatCount="indefinite"/></circle>
      <rect x="110" y="98" width="22" height="18" rx="5" fill="#b8c0d8" stroke="#f1effa" stroke-width="2"/><rect x="114" y="103" width="14" height="7" rx="3" fill="#1b1730"/><circle cx="118" cy="106.5" r="1.8" fill="#3ef0ff"/><circle cx="124" cy="106.5" r="1.8" fill="#3ef0ff"/>
      <rect x="113" y="118" width="16" height="16" rx="4" fill="#8f99b8" stroke="#f1effa" stroke-width="2"/><rect x="113" y="136" width="6" height="8" rx="2" fill="#8f99b8"/><rect x="123" y="136" width="6" height="8" rx="2" fill="#8f99b8"/>`;
    case 'dragon': return bob(`<path d="M112 122 q-12 -14 -2 -24 q2 10 10 12z" fill="#14a37f" stroke="#f1effa" stroke-width="1.6"/><ellipse cx="122" cy="128" rx="12" ry="10" fill="#3dffa8" stroke="#f1effa" stroke-width="2"/><ellipse cx="124" cy="131" rx="6" ry="5" fill="#e6ff9c"/>
      <circle cx="130" cy="114" r="8" fill="#3dffa8" stroke="#f1effa" stroke-width="2"/><path d="M126 107 l-2 -6 4 3z M133 107 l2 -6 -4 3z" fill="#ffd25a"/><circle cx="132" cy="113" r="1.8" fill="#0b0918"/><path d="M110 132 q-8 4 -10 -2" stroke="#3dffa8" stroke-width="4" fill="none" stroke-linecap="round"/>`, 2.8);
    case 'comet': return `<defs><linearGradient id="${id}t" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd25a"/><stop offset="1" stop-color="#ff4fd8" stop-opacity="0"/></linearGradient></defs>` + bob(`<path d="M120 112 L96 92 L104 90 L92 80 L124 106z" fill="url(#${id}t)" opacity=".85"/><path d="M122 100 l3.5 7.5 8 1.2 -6 5.5 1.6 8 -7.1 -4 -7.1 4 1.6 -8 -6 -5.5 8 -1.2z" fill="#ffd25a" stroke="#fff3b0" stroke-width="1.5"/><circle cx="120" cy="110" r="1.2" fill="#0b0918"/><circle cx="124.5" cy="110" r="1.2" fill="#0b0918"/>`, 2);
    default: return '';
  }
}

/* Poses : position des bras. */
function armsSvg(pose: string): string {
  const arm = (d: string, hx: number, hy: number) => `<path d="${d}" fill="none" stroke="#f1effa" stroke-width="5" stroke-linecap="round"/><circle cx="${hx}" cy="${hy}" r="5" fill="#f1effa"/>`;
  switch (pose) {
    case 'cheer': return arm('M20 72 q-12 -2 -12 -16', 8, 54) + arm('M104 72 q12 -2 12 -16', 116, 54);
    case 'hips': return arm('M20 70 q-16 10 0 24', 20, 94) + arm('M104 70 q16 10 0 24', 104, 94);
    case 'point': return arm('M20 72 q-12 2 -12 16', 8, 90) + arm('M104 68 q10 -12 8 -30', 112, 36);
    default: return arm('M20 72 q-12 2 -12 16', 8, 90) + arm('M104 72 q12 -2 12 -16', 116, 54);
  }
}

/** Personnage du joueur, en SVG. */
export function avatarSvg(look: Look, mood: Mood = 'happy', size = 120, label = 'Ton personnage'): string {
  const id = `av${++uid}`;
  const p = PALETTES.find((x) => x.id === look.palette) ?? PALETTES[0];
  const { eyes, mouth, extra, cheeks } = faceParts(mood);
  const stops = p.stops.map((c, i) => `<stop offset="${(i / (p.stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const spin = p.spin ? '<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="8s" repeatCount="indefinite"/>' : '';
  const W = 152, H = 176;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="avatar-svg" viewBox="-14 -16 ${W} ${H}" width="${size}" height="${Math.round(size * H / W)}" ${a11y}>
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}${spin}</linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  ${bgSvg(look.bg, id)}
  ${auraSvg(look.aura, id, p)}
  <ellipse cx="62" cy="150" rx="40" ry="6" fill="#000" opacity=".35"/>
  <g class="av-body">
    <ellipse cx="45" cy="137" rx="12" ry="7" fill="${p.feet}" stroke="#f1effa" stroke-width="2.5"/>
    <ellipse cx="79" cy="137" rx="12" ry="7" fill="${p.feet}" stroke="#f1effa" stroke-width="2.5"/>
    ${armsSvg(look.pose)}
    <rect x="20" y="22" width="84" height="108" rx="16" fill="url(#${id}g)" stroke="#f1effa" stroke-width="3"/>
    <rect x="20" y="22" width="84" height="108" rx="16" fill="url(#${id}s)"/>
    <rect x="29" y="40" width="66" height="62" rx="12" fill="#f8f6ff"/>
    <path d="M36 118 h52" stroke="#0b0918" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    <path d="M52 32 l8 -6 8 4 10 -9" fill="none" stroke="#0b0918" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${cheeks}
    <g fill="none" stroke="#0b0918" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${eyes}${mouth}</g>
    ${extra}
    ${accSvg(look.acc, id)}
  </g>
  <g transform="translate(-6 0)">${petSvg(look.pet, id)}</g>
</svg>`;
}

/** Le personnage enregistré du joueur. */
export function myAvatarSvg(size = 120, level = 99, label?: string): string {
  return avatarSvg(getLook(level), getMood(), size, label);
}
