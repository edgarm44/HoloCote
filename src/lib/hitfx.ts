// Révélation spectaculaire de la dernière carte d'un booster : plein écran, plus ou moins longue selon la rareté.
// Niveau 0 : courte. Niveau 3 (carte exceptionnelle) : charge d'énergie, éclair, gerbe d'étincelles, carte holo qui se retourne.
// Un clic ou la touche Échap passe l'animation. Rien n'est joué si l'on a demandé moins d'animations.

const COLORS = ['#8aa4ff', '#3ef0ff', '#ff4fd8', '#ffd25a'];
const LABELS = ['Dernière carte', 'Belle prise !', 'Superbe carte !', 'Carte exceptionnelle !'];
const TOTAL = [1000, 1700, 2300, 3000]; // durée de la séquence, en ms
const FLIP_AT = [0.45, 0.5, 0.52, 0.55]; // part de la séquence où la carte se retourne

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function preload(url: string): Promise<void> {
  return new Promise((res) => {
    const img = new Image();
    const done = () => res();
    img.onload = done; img.onerror = done;
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    setTimeout(done, 1500);
  });
}

/** Joue l'animation ; la promesse est tenue au moment où la carte est révélée (le fond finit de s'effacer ensuite). */
export async function playHitReveal(level: 0 | 1 | 2 | 3, image?: string, name = ''): Promise<void> {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* rien */ }
  const url = image ? `${image}/high.webp` : '';
  if (url) void preload(url); // l'image se charge pendant la charge d'énergie
  const total = TOTAL[level];
  const color = COLORS[level];
  const root = document.createElement('div');
  root.className = `hfx hfx-l${level}`;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--c', color);
  root.style.setProperty('--t', `${total}ms`);
  root.style.setProperty('--flip', `${Math.round(total * FLIP_AT[level])}ms`);
  const sparks = [18, 34, 54, 80][level];
  const spark = Array.from({ length: sparks }, (_, i) => {
    const a = (i / sparks) * 360 + Math.random() * 14;
    const d = 140 + Math.random() * (160 + level * 90);
    return `<i style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px;--s:${(0.5 + Math.random() * 1.1).toFixed(2)};--dl:${Math.round(Math.random() * 120)}ms"></i>`;
  }).join('');
  const front = url ? `<img src="${url}" alt="" referrerpolicy="no-referrer" />` : `<span class="hfx-noimg">${name.replace(/[<>&]/g, '')}</span>`;
  root.innerHTML = `
    <div class="hfx-bg"></div>
    <div class="hfx-rays"></div>
    <div class="hfx-ring r1"></div><div class="hfx-ring r2"></div><div class="hfx-ring r3"></div>
    <div class="hfx-orb"></div>
    <div class="hfx-card"><div class="hfx-spin"><div class="hfx-face hfx-back"><span>10</span></div><div class="hfx-face hfx-front">${front}<b class="hfx-shine"></b></div></div></div>
    <div class="hfx-sparks">${spark}</div>
    <div class="hfx-flash"></div>
    <p class="hfx-label">${LABELS[level]}</p>`;
  document.body.append(root);
  let skipped = false;
  const flipMs = total * FLIP_AT[level];
  let finish: () => void = () => {};
  const skip = () => { skipped = true; finish(); };
  root.addEventListener('click', skip);
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
  document.addEventListener('keydown', key);
  await new Promise<void>((resolve) => {
    finish = resolve;
    setTimeout(resolve, flipMs + 950 + level * 220);
  });
  document.removeEventListener('keydown', key);
  // Fondu de sortie pendant que la vraie carte apparaît dessous.
  root.classList.add('out');
  setTimeout(() => root.remove(), skipped ? 150 : 700);
  if (!skipped) await wait(120);
}
