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
  { id: 'or', name: 'Or massif', lvl: 13, stops: ['#fff3b0', '#ffd25a', '#d99a1e', '#fff1c2'], feet: '#b67d10' },
  { id: 'prisme', name: 'Prisme', lvl: 20, stops: ['#ff4f6d', '#ffd25a', '#3dffa8', '#3ef0ff', '#8a7bff', '#ff4fd8'], feet: '#8a7bff', spin: true },
];
export const ACCESSORIES: Item[] = [
  { id: 'none', name: 'Aucun', lvl: 1 },
  { id: 'cap', name: 'Casquette', lvl: 3 },
  { id: 'glasses', name: 'Lunettes', lvl: 5 },
  { id: 'scarf', name: 'Écharpe', lvl: 7 },
  { id: 'phones', name: 'Casque audio', lvl: 10 },
  { id: 'crown', name: 'Couronne', lvl: 15 },
  { id: 'halo', name: 'Auréole', lvl: 18 },
];
export const AURAS: Item[] = [
  { id: 'none', name: 'Aucune', lvl: 1 },
  { id: 'sparkle', name: 'Étincelles', lvl: 2 },
  { id: 'glow', name: 'Halo', lvl: 8 },
  { id: 'flame', name: 'Flammes', lvl: 12 },
  { id: 'galaxy', name: 'Galaxie', lvl: 16 },
];
export const MOODS: Mood[] = ['happy', 'wink', 'wow', 'think', 'sad'];

export interface Look { palette: string; acc: string; aura: string }
const DEFAULT: Look = { palette: 'holo', acc: 'none', aura: 'none' };
const LOOK = 'holocote.look.v1';
const MOOD = 'holocote.avatar.v1';

const unlocked = (list: Item[], id: string, level: number) => list.some((x) => x.id === id && x.lvl <= level);

export function getLook(level = 99): Look {
  let raw: Partial<Look> = {};
  try { raw = JSON.parse(localStorage.getItem(LOOK) || '{}') ?? {}; } catch { /* rien */ }
  return {
    palette: raw.palette && unlocked(PALETTES, raw.palette, level) ? raw.palette : DEFAULT.palette,
    acc: raw.acc && unlocked(ACCESSORIES, raw.acc, level) ? raw.acc : DEFAULT.acc,
    aura: raw.aura && unlocked(AURAS, raw.aura, level) ? raw.aura : DEFAULT.aura,
  };
}
export function setLook(look: Look, level: number) {
  const safe: Look = {
    palette: unlocked(PALETTES, look.palette, level) ? look.palette : DEFAULT.palette,
    acc: unlocked(ACCESSORIES, look.acc, level) ? look.acc : DEFAULT.acc,
    aura: unlocked(AURAS, look.aura, level) ? look.aura : DEFAULT.aura,
  };
  try { localStorage.setItem(LOOK, JSON.stringify(safe)); } catch { /* rien */ }
}
export function getMood(): Mood {
  try { const m = localStorage.getItem(MOOD) as Mood; return MOODS.includes(m) ? m : 'happy'; } catch { return 'happy'; }
}

/** Objets débloqués exactement à ce niveau (pour l'annonce de passage de niveau). */
export function unlocksAt(level: number): string[] {
  return [...PALETTES.map((p) => ({ ...p, kind: 'Couleur' })), ...ACCESSORIES.map((a) => ({ ...a, kind: 'Accessoire' })), ...AURAS.map((a) => ({ ...a, kind: 'Aura' }))]
    .filter((x) => x.lvl === level && x.id !== 'none' && x.lvl > 1)
    .map((x) => `${x.kind.toLowerCase()} ${x.name}`);
}
/** Prochain objet à débloquer après ce niveau. */
export function nextUnlock(level: number): { lvl: number; label: string } | null {
  const all = [...PALETTES.map((p) => ({ lvl: p.lvl, label: `la couleur ${p.name}` })), ...ACCESSORIES.filter((a) => a.id !== 'none').map((a) => ({ lvl: a.lvl, label: `l'accessoire ${a.name}` })), ...AURAS.filter((a) => a.id !== 'none').map((a) => ({ lvl: a.lvl, label: `l'aura ${a.name}` }))];
  return all.filter((x) => x.lvl > level).sort((a, b) => a.lvl - b.lvl)[0] ?? null;
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
    default: return '';
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
  ${auraSvg(look.aura, id, p)}
  <ellipse cx="62" cy="150" rx="40" ry="6" fill="#000" opacity=".35"/>
  <g class="av-body">
    <ellipse cx="45" cy="137" rx="12" ry="7" fill="${p.feet}" stroke="#f1effa" stroke-width="2.5"/>
    <ellipse cx="79" cy="137" rx="12" ry="7" fill="${p.feet}" stroke="#f1effa" stroke-width="2.5"/>
    <path d="M20 72 q-12 2 -12 16" fill="none" stroke="#f1effa" stroke-width="5" stroke-linecap="round"/><circle cx="8" cy="90" r="5" fill="#f1effa"/>
    <path d="M104 72 q12 -2 12 -16" fill="none" stroke="#f1effa" stroke-width="5" stroke-linecap="round"/><circle cx="116" cy="54" r="5" fill="#f1effa"/>
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
</svg>`;
}

/** Le personnage enregistré du joueur. */
export function myAvatarSvg(size = 120, level = 99, label?: string): string {
  return avatarSvg(getLook(level), getMood(), size, label);
}
