// Petites fonctions d'interface partagées (exécutées dans le navigateur).

import { imageUrl, getCard, priceFor, type Card, type CardBrief, type Lang } from './tcgdex';
import { favButton } from './favorites';

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

/** Visuel de carte avec effet holographique. */
export function holoCard(image: string | undefined, alt: string, quality: 'low' | 'high' = 'low'): HTMLElement {
  const box = el('div', { class: 'holo-card' });
  const src = imageUrl(image, quality);
  if (src) {
    const img = el('img', { src, alt, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    // Image française absente chez TCGdex : on tente l'anglaise (ici ou via le filet global de la page),
    // puis un cadre de remplacement si elle manque aussi.
    let fails = 0;
    img.addEventListener('error', () => {
      fails++;
      if (fails === 1 && /\/(fr|en)\//.test(src)) {
        if (img.src.includes('/fr/')) { img.dataset.fbk = '1'; img.src = img.src.replace('/fr/', '/en/'); }
        return;
      }
      if (img.isConnected) img.replaceWith(el('div', { class: 'placeholder' }, [alt]));
    });
    box.append(img);
  } else {
    box.append(el('div', { class: 'placeholder' }, [alt, el('br'), 'Image indisponible']));
  }
  attachTilt(box);
  return box;
}

export function attachTilt(box: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  box.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    box.style.setProperty('--mx', `${x * 100}%`);
    box.style.setProperty('--my', `${y * 100}%`);
    box.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
    box.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
    box.classList.add('is-active');
  });
  box.addEventListener('pointerleave', () => {
    box.style.setProperty('--rx', '0deg');
    box.style.setProperty('--ry', '0deg');
    box.classList.remove('is-active');
  });
}

/** Données d'un favori à partir des détails d'une carte (avec sa cote du moment). */
export function favInfo(card: Card) {
  const p = priceFor(card, 'normal');
  return { name: card.name, image: card.image, setName: card.set?.name, rarity: card.rarity, priceAtAdd: p?.value, unit: p?.unit };
}

/** Étoile favori pour une carte dont on n'a que le résumé : les détails sont chargés au clic. */
export function favForBrief(c: CardBrief, lang: Lang, className = 'tile-fav'): HTMLButtonElement {
  return favButton(c.id, lang, async () => {
    const card = await getCard(c.id, lang).catch(() => null);
    return card ? favInfo(card) : { name: c.name, image: c.image };
  }, { className });
}

export function cardTile(card: CardBrief, lang: Lang, meta?: string): HTMLElement {
  return el('div', { class: 'tile-wrap' }, [
    el('a', { class: 'tile', href: url(`/carte/?id=${encodeURIComponent(card.id)}&lang=${lang}`) }, [
      holoCard(card.image, card.name),
      el('span', { class: 'tile-name' }, [card.name]),
      el('span', { class: 'tile-meta' }, [meta ?? `N° ${card.localId} · ${card.id.split('-')[0]}`]),
    ]),
    favForBrief(card, lang),
  ]);
}

export function status(text: string, loading = true): HTMLElement {
  return el('div', { class: 'status', role: 'status' }, [loading ? el('div', { class: 'spinner' }) : null, text]);
}

let toastTimer: number | undefined;
export function toast(message: string) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2600);
}

export function getLang(): Lang {
  const p = new URLSearchParams(location.search).get('lang');
  if (p === 'fr' || p === 'en') return p;
  try {
    const s = localStorage.getItem('holocote.lang');
    if (s === 'fr' || s === 'en') return s;
  } catch { /* rien */ }
  return 'fr';
}

export function rememberLang(lang: Lang) {
  try { localStorage.setItem('holocote.lang', lang); } catch { /* rien */ }
}
