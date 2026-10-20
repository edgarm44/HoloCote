// Ouverture du sachet de booster, en plein écran : le sachet tombe, tremble de plus en plus fort, le haut se déchire,
// la lumière jaillit et les cartes sortent. Un clic ou la touche Échap passe l'animation.
// Rien n'est joué si l'on a demandé moins d'animations.

export interface PackFx { label?: string; sub?: string; colors?: [string, string, string]; hits?: number }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Instant (ms) où le haut se déchire ; la promesse est tenue peu après. */
export const RIP_AT = 1450;
export const PACK_TOTAL = 2250;

function zig(top: boolean): string {
  const n = 10, y0 = 14, y1 = 19;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${i % 2 ? y1 : y0}%`);
  return top
    ? `polygon(0 0, 100% 0, ${pts.reverse().join(', ')})`
    : `polygon(${pts.reverse().reverse().join(', ')}, 100% 100%, 0 100%)`;
}

export async function playPackOpen(o: PackFx = {}): Promise<void> {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* rien */ }
  const [a, b, c] = o.colors ?? ['#3ef0ff', '#8a7bff', '#ff4fd8'];
  const root = document.createElement('div');
  root.className = 'pfx';
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--a', a); root.style.setProperty('--b', b); root.style.setProperty('--c', c);
  root.style.setProperty('--zt', zig(true)); root.style.setProperty('--zb', zig(false));
  const esc = (s: string) => s.replace(/[<>&"]/g, '');
  const sparks = Array.from({ length: 36 }, (_, i) => {
    const ang = (i / 36) * 360 + Math.random() * 10;
    return `<i style="--a:${ang.toFixed(0)}deg;--d:${(120 + Math.random() * 260).toFixed(0)}px;--s:${(0.5 + Math.random()).toFixed(2)};--dl:${Math.round(Math.random() * 100)}ms"></i>`;
  }).join('');
  root.innerHTML = `
    <div class="pfx-bg"></div>
    <div class="pfx-beams"></div>
    <div class="pfx-wrap">
      <div class="pfx-stack"><i></i><i></i><i></i></div>
      <div class="pfx-pack">
        <div class="pfx-face pfx-body">
          <span class="pfx-brand">HoloCote</span>
          <span class="pfx-set">${esc(o.label ?? 'Booster')}</span>
          ${o.sub ? `<span class="pfx-sub">${esc(o.sub)}</span>` : ''}
          <span class="pfx-crimp"></span>
        </div>
        <div class="pfx-face pfx-top"></div>
      </div>
    </div>
    <div class="pfx-flash"></div>
    <div class="pfx-sparks">${sparks}</div>
    <p class="pfx-hint">Touche pour passer</p>`;
  document.body.append(root);
  let skipped = false;
  let done: () => void = () => {};
  const skip = () => { skipped = true; done(); };
  root.addEventListener('click', skip);
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
  document.addEventListener('keydown', key);
  await new Promise<void>((res) => { done = res; setTimeout(res, PACK_TOTAL - 150); });
  document.removeEventListener('keydown', key);
  root.classList.add('out');
  setTimeout(() => root.remove(), skipped ? 120 : 650);
  if (!skipped) await wait(80);
}

/** Départ des cartes : chaque carte part du centre de la grille et se pose à sa place, avec un léger décalage. */
export function dealCards(cards: HTMLElement[], opts: { delay?: number; step?: number } = {}) {
  const step = opts.step ?? 110, delay = opts.delay ?? 0;
  if (!cards.length) return;
  const parent = cards[0].parentElement;
  const pr = parent?.getBoundingClientRect();
  const cx = pr ? pr.left + pr.width / 2 : innerWidth / 2, cy = pr ? pr.top + pr.height / 2 : innerHeight / 2;
  cards.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--dx', `${Math.round(cx - (r.left + r.width / 2))}px`);
    el.style.setProperty('--dy', `${Math.round(cy - (r.top + r.height / 2))}px`);
    el.style.setProperty('--rot', `${Math.round(-18 + Math.random() * 36)}deg`);
    el.style.animationDelay = `${delay + i * step}ms`;
    el.classList.add('dealin');
  });
}
