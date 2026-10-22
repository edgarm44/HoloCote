// Dévoilement des cartes d'un booster, une par une, en plein écran : la carte arrive face cachée, se retourne avec un éclat
// aux couleurs de sa rareté, marque une pause (plus longue pour les belles cartes), puis file se ranger à sa place dans la grille.
// Un clic passe à la carte suivante ; « Tout passer » ou Échap affiche le reste d'un coup. Rien n'est animé si l'on a demandé moins d'animations.

export interface DeckItem {
  image?: string;
  name: string;
  price?: string;
  /** Carte que le joueur n'a pas encore dans son classeur. */
  isNew?: boolean;
  /** Niveau de rareté de la carte : 0 (commune) à 3 (exceptionnelle). */
  lvl: number;
  /** Emplacement de la carte dans la grille (vers lequel elle s'envole). */
  target?: HTMLElement | null;
  /** Appelé quand la carte est posée : c'est là qu'on la montre dans la grille. */
  land: () => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const esc = (s: string) => s.replace(/[<>&"]/g, '');
const LABEL = ['', 'Belle prise', 'Superbe carte', 'Carte exceptionnelle'];

export async function playDeck(items: DeckItem[], o: { colors?: [string, string, string]; title?: string; decor?: string } = {}): Promise<void> {
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* rien */ }
  if (reduced || !items.length) { items.forEach((it) => it.land()); return; }
  const [a, b, c] = o.colors ?? ['#3ef0ff', '#8a7bff', '#ff4fd8'];
  const root = document.createElement('div');
  root.className = 'dfx';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Dévoilement des cartes du booster');
  root.style.setProperty('--a', a); root.style.setProperty('--b', b); root.style.setProperty('--c', c);
  root.innerHTML = `
    <div class="dfx-bg"></div>
    <div class="dfx-rays"></div>
    <header class="dfx-top"><span class="dfx-title">${esc(o.title ?? 'Ton booster')}</span><span class="dfx-count" id="dfx-count">1 / ${items.length}</span></header>
    <div class="dfx-dots">${items.map(() => '<i></i>').join('')}</div>
    <div class="dfx-stage">
      <div class="dfx-pile"><i></i><i></i><i></i></div>
      <div class="dfx-card" id="dfx-card"><div class="dfx-in"><div class="dfx-back"><span>HC</span></div><div class="dfx-front"></div><span class="dfx-new" id="dfx-new" hidden>Nouvelle</span><div class="dfx-shine"></div></div></div>
      <div class="dfx-sparks" id="dfx-sparks"></div>
    </div>
    <div class="dfx-info"><p class="dfx-tag" id="dfx-tag"></p><p class="dfx-name" id="dfx-name"></p><p class="dfx-price" id="dfx-price"></p></div>
    <p class="dfx-hint">Touche pour la carte suivante</p>
    <div class="dfx-btns"><button type="button" class="dfx-skip" id="dfx-fast" aria-pressed="false">Rapide</button><button type="button" class="dfx-skip" id="dfx-skip">Tout passer</button></div>`;
  if (o.decor) {
    // Décor de l'événement (feuilles, papier, éclats…) qui tombe derrière la carte.
    const fx = document.createElement('div');
    fx.className = 'ev-fx dfx-fx';
    const n = innerWidth < 720 ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = `evp evp-${o.decor}`;
      p.style.cssText = `--x:${(i / n) * 100 + Math.random() * (100 / n)}%;--d:${(5 + Math.random() * 6).toFixed(1)}s;--delay:${(-Math.random() * 8).toFixed(1)}s;--s:${(0.6 + Math.random() * 0.9).toFixed(2)};--sway:${Math.round(-90 + Math.random() * 180)}px;--r0:${Math.round(Math.random() * 360)}deg;--spin:${(1.8 + Math.random() * 2.4).toFixed(1)}s`;
      fx.append(p);
    }
    root.querySelector('.dfx-rays')!.after(fx);
  }
  document.body.append(root);
  document.body.classList.add('dfx-lock');
  const $ = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const card = $('dfx-card'), front = root.querySelector('.dfx-front') as HTMLElement, sparks = $('dfx-sparks');
  const dots = Array.from(root.querySelectorAll('.dfx-dots i')) as HTMLElement[];

  let fast = false;
  try { fast = localStorage.getItem('holocote.deckfast.v1') === '1'; } catch { /* rien */ }
  const fastBtn = $('dfx-fast');
  const paintFast = () => { fastBtn.setAttribute('aria-pressed', String(fast)); fastBtn.textContent = fast ? 'Rapide : oui' : 'Rapide'; };
  paintFast();
  let skipAll = false;
  let nudge: () => void = () => {};
  const next = () => nudge();
  root.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'dfx-fast') { fast = !fast; try { localStorage.setItem('holocote.deckfast.v1', fast ? '1' : '0'); } catch { /* rien */ } paintFast(); return; }
    if (id === 'dfx-skip') skipAll = true;
    nudge();
  });
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { skipAll = true; nudge(); } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); } };
  document.addEventListener('keydown', key);
  /** Attend `ms` millisecondes, ou jusqu'à un clic. */
  const hold = (ms: number) => new Promise<void>((res) => { const t = setTimeout(res, ms); nudge = () => { clearTimeout(t); res(); }; });

  const burst = (lvl: number) => {
    sparks.replaceChildren();
    const n = [10, 18, 28, 46][lvl];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.style.cssText = `--an:${(i / n) * 360 + Math.random() * 12}deg;--d:${90 + Math.random() * (120 + lvl * 60)}px;--s:${(0.5 + Math.random()).toFixed(2)};--dl:${Math.round(Math.random() * 90)}ms`;
      sparks.append(s);
    }
  };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (skipAll) { it.land(); dots[i]?.classList.add('done'); continue; }
    const lvl = Math.max(0, Math.min(3, it.lvl | 0));
    $('dfx-count').textContent = `${i + 1} / ${items.length}`;
    dots[i]?.classList.add('now');
    root.dataset.lvl = String(lvl);
    // 1. la carte arrive face cachée
    front.replaceChildren();
    if (it.image) {
      const img = document.createElement('img');
      img.alt = it.name; img.referrerPolicy = 'no-referrer'; img.src = `${it.image}/low.webp`;
      img.addEventListener('error', () => { if (img.src.includes('/fr/')) img.src = img.src.replace('/fr/', '/en/'); else img.replaceWith(Object.assign(document.createElement('span'), { className: 'dfx-ph', textContent: it.name })); });
      front.append(img);
    } else front.append(Object.assign(document.createElement('span'), { className: 'dfx-ph', textContent: it.name }));
    $('dfx-tag').textContent = ''; $('dfx-name').textContent = ''; $('dfx-price').textContent = '';
    $('dfx-new').hidden = true;
    root.classList.remove('flip', 'fly');
    card.style.transition = 'none'; card.style.transform = ''; card.style.opacity = '';
    void card.offsetWidth;
    card.style.transition = '';
    root.classList.add('enter');
    await hold(380);
    if (skipAll) { it.land(); dots[i]?.classList.add('done'); root.classList.remove('enter'); continue; }
    // 2. elle se retourne : éclat, étincelles et texte
    root.classList.remove('enter');
    root.classList.add('flip');
    burst(lvl);
    sparks.classList.remove('go'); void sparks.offsetWidth; sparks.classList.add('go');
    await hold(fast ? 250 : 430);
    $('dfx-new').hidden = !it.isNew;
    $('dfx-tag').textContent = it.isNew && lvl === 0 ? 'Nouvelle carte' : LABEL[lvl];
    $('dfx-name').textContent = it.name;
    $('dfx-price').textContent = it.price ?? '';
    // 3. pause, plus longue pour les belles cartes
    await hold(skipAll ? 0 : [620, 950, 1500, 2200][lvl] * (fast ? 0.45 : 1));
    // 4. elle s'envole vers sa place dans la grille
    if (!skipAll && it.target) {
      const r = it.target.getBoundingClientRect(), s = card.getBoundingClientRect();
      if (r.width > 0) {
        const dx = r.left + r.width / 2 - (s.left + s.width / 2), dy = r.top + r.height / 2 - (s.top + s.height / 2);
        const k = Math.max(0.12, Math.min(0.6, r.width / s.width));
        root.classList.add('fly');
        card.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${k.toFixed(3)})`;
        card.style.opacity = '0.2';
        await wait(420);
      }
    }
    it.land();
    dots[i]?.classList.remove('now'); dots[i]?.classList.add('done');
  }
  document.removeEventListener('keydown', key);
  document.body.classList.remove('dfx-lock');
  root.classList.add('out');
  await wait(skipAll ? 80 : 420);
  root.remove();
}

// Retour arrière du navigateur (page restaurée telle quelle) : on retire tout écran de dévoilement resté ouvert.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (e) => {
    if (!(e as PageTransitionEvent).persisted) return;
    document.querySelectorAll('.dfx, .pfx, .hfx').forEach((n) => n.remove());
    document.body.classList.remove('dfx-lock');
  });
}
