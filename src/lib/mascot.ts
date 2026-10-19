// Coti, la mascotte originale de HoloCote : une petite carte holographique vivante.
// Dessin 100 % original (aucun personnage existant), utilisable côté Astro (set:html) et côté navigateur.

export type Mood = 'happy' | 'wow' | 'sad' | 'think' | 'wink';

let uid = 0;

/** Expression du visage (yeux, bouche, détails) : partagée avec l'avatar du joueur. */
export function faceParts(mood: Mood) {
  const eyes = {
    happy: '<path d="M44 66 q6 -7 12 0" /><path d="M68 66 q6 -7 12 0" />',
    wow: '<circle cx="50" cy="64" r="6.5" fill="#0b0918" stroke="none"/><circle cx="74" cy="64" r="6.5" fill="#0b0918" stroke="none"/><circle cx="52" cy="61.5" r="2.2" fill="#fff" stroke="none"/><circle cx="76" cy="61.5" r="2.2" fill="#fff" stroke="none"/>',
    sad: '<path d="M44 62 q6 5 12 2" /><path d="M68 64 q6 3 12 -2" />',
    think: '<circle cx="52" cy="61" r="5" fill="#0b0918" stroke="none"/><circle cx="76" cy="61" r="5" fill="#0b0918" stroke="none"/>',
    wink: '<circle cx="50" cy="64" r="5.5" fill="#0b0918" stroke="none"/><circle cx="51.8" cy="62" r="1.8" fill="#fff" stroke="none"/><path d="M68 65 q6 -6 12 0" />',
  }[mood];
  const mouth = {
    happy: '<path d="M52 80 q10 10 20 0" />',
    wow: '<ellipse cx="62" cy="83" rx="6" ry="7" fill="#0b0918" stroke="none"/>',
    sad: '<path d="M53 86 q9 -8 18 0" />',
    think: '<path d="M56 85 q6 -3 12 0" />',
    wink: '<path d="M52 80 q10 10 20 0" />',
  }[mood];
  const extra = mood === 'sad'
    ? '<path d="M82 70 q3 6 0 9 q-3 -3 0 -9z" fill="#7fdcff" stroke="none"/>'
    : mood === 'wow'
      ? '<path d="M14 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#ffd25a" stroke="none"/><path d="M106 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#3ef0ff" stroke="none"/>'
      : mood === 'think'
        ? '<circle cx="104" cy="36" r="3" fill="#fff" stroke="none" opacity=".7"/><circle cx="111" cy="26" r="4.5" fill="#fff" stroke="none" opacity=".85"/>'
        : '';
  const cheeks = mood === 'sad' ? '' : '<ellipse cx="42" cy="76" rx="5" ry="3" fill="#ff4fd8" opacity=".45" stroke="none"/><ellipse cx="82" cy="76" rx="5" ry="3" fill="#ff4fd8" opacity=".45" stroke="none"/>';
  return { eyes, mouth, extra, cheeks };
}

export function mascotSvg(mood: Mood = 'happy', size = 120, label = 'Coti, la mascotte de HoloCote'): string {
  const id = `coti${++uid}`;
  const { eyes, mouth, extra, cheeks } = faceParts(mood);
  return `<svg class="coti coti-${mood}" viewBox="0 0 124 140" width="${size}" height="${Math.round(size * 140 / 124)}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3ef0ff"/><stop offset=".35" stop-color="#8a7bff"/><stop offset=".7" stop-color="#ff4fd8"/><stop offset="1" stop-color="#ffd25a"/>
    </linearGradient>
  </defs>
  <g class="coti-body">
    <path d="M18 70 q-10 4 -8 16" fill="none" stroke="#f1effa" stroke-width="5" stroke-linecap="round"/>
    <path d="M106 70 q10 -2 10 -14" fill="none" stroke="#f1effa" stroke-width="5" stroke-linecap="round"/>
    <rect x="20" y="22" width="84" height="108" rx="16" fill="url(#${id}g)" stroke="#f1effa" stroke-width="3"/>
    <rect x="29" y="40" width="66" height="62" rx="12" fill="#f8f6ff"/>
    <path d="M36 118 h52" stroke="#0b0918" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    <path d="M52 30 l8 -6 8 4 10 -9" fill="none" stroke="#0b0918" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 8 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6z" fill="#fff"/>
    ${cheeks}
    <g fill="none" stroke="#0b0918" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${eyes}${mouth}</g>
    ${extra}
  </g>
</svg>`;
}
