// Alertes de prix sur les favoris, entièrement dans le navigateur (aucun e-mail, aucun serveur).
// Trois déclencheurs :
//   - prix cible : le cours descend à un prix fixé ou moins (bon moment pour acheter) ;
//   - plafond : le cours monte à un prix fixé ou plus ;
//   - variation : le cours a bougé de plus de X % depuis la dernière alerte vue.
// Les cours sont vérifiés à chaque visite (au plus toutes les 30 minutes). Si l'utilisateur
// l'autorise, une notification du navigateur s'affiche aussi (tant qu'un onglet HoloDex est ouvert).

import { getFavorites, setRefPrices, setTargets, type Favorite } from './favorites';
import { getCard, priceFor, type Lang } from './tcgdex';

export interface AlertSettings {
  enabled: boolean;
  threshold: number;              // en % ; 0 = pas d'alerte de variation
  direction: 'both' | 'up' | 'down';
  notify: boolean;                // notifications du navigateur
}

export type AlertKind = 'below' | 'above' | 'move';

export interface PriceAlert {
  key: string;
  kind: AlertKind;
  cardId: string;
  lang: Lang;
  name: string;
  image?: string;
  from: number;                   // prix de référence (ou cible)
  to: number;                     // cours actuel
  unit: 'EUR' | 'USD';
  pct: number;                    // variation par rapport à la référence
}

interface State { checkedAt: number; alerts: PriceAlert[]; notified: string[] }

const SETTINGS_KEY = 'holocote.alerts.settings.v2';
const STATE_KEY = 'holocote.alerts.state.v2';
const EVENT = 'holocote:alerts';
const EVERY = 30 * 60 * 1000;
export const DEFAULT_SETTINGS: AlertSettings = { enabled: true, threshold: 10, direction: 'both', notify: false };

function read<T>(key: string): T | null {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* rien */ }
}
const readState = (): State => {
  const s = read<Partial<State>>(STATE_KEY) ?? {};
  return { checkedAt: s.checkedAt ?? 0, alerts: Array.isArray(s.alerts) ? s.alerts : [], notified: Array.isArray(s.notified) ? s.notified : [] };
};

export function getSettings(): AlertSettings {
  const s = read<Partial<AlertSettings>>(SETTINGS_KEY) ?? {};
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled,
    threshold: [0, 5, 10, 20, 50].includes(Number(s.threshold)) ? Number(s.threshold) : DEFAULT_SETTINGS.threshold,
    direction: s.direction === 'up' || s.direction === 'down' ? s.direction : 'both',
    notify: !!s.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted',
  };
}

export function setSettings(s: AlertSettings) {
  write(SETTINGS_KEY, s);
  write(STATE_KEY, { ...readState(), checkedAt: 0 }); // nouveau réglage : on recalcule
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Demande l'autorisation d'afficher des notifications ; renvoie true si accordée. */
export async function enableNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const ok = perm === 'granted';
  if (ok) await swRegistration();
  write(SETTINGS_KEY, { ...getSettings(), notify: ok });
  window.dispatchEvent(new CustomEvent(EVENT));
  return ok;
}

export const notificationsSupported = () => typeof Notification !== 'undefined';

export function currentAlerts(): PriceAlert[] {
  if (!getSettings().enabled) return [];
  const favs = getFavorites();
  return readState().alerts.filter((a) => favs.some((f) => f.cardId === a.cardId && f.lang === a.lang));
}

export const onAlertsChange = (cb: () => void) => window.addEventListener(EVENT, cb);

export function alertText(a: PriceAlert, fmt: (v: number, u: 'EUR' | 'USD') => string): string {
  if (a.kind === 'below') return `${a.name} est descendue à ${fmt(a.to, a.unit)} (ta cible : ${fmt(a.from, a.unit)})`;
  if (a.kind === 'above') return `${a.name} a dépassé ${fmt(a.from, a.unit)} : ${fmt(a.to, a.unit)}`;
  return `${a.name} : ${a.pct > 0 ? '+' : ''}${a.pct.toFixed(0)} % (${fmt(a.from, a.unit)} → ${fmt(a.to, a.unit)})`;
}

function evaluate(f: Favorite, price: number, unit: 'EUR' | 'USD', s: AlertSettings): PriceAlert[] {
  const base = { cardId: f.cardId, lang: f.lang, name: f.name, image: f.image, to: price, unit };
  const out: PriceAlert[] = [];
  if (f.targetBelow && price <= f.targetBelow) {
    out.push({ ...base, key: `below:${f.lang}:${f.cardId}:${f.targetBelow}`, kind: 'below', from: f.targetBelow, pct: ((price - f.targetBelow) / f.targetBelow) * 100 });
  }
  if (f.targetAbove && price >= f.targetAbove) {
    out.push({ ...base, key: `above:${f.lang}:${f.cardId}:${f.targetAbove}`, kind: 'above', from: f.targetAbove, pct: ((price - f.targetAbove) / f.targetAbove) * 100 });
  }
  const ref = f.refPrice ?? f.priceAtAdd;
  if (s.threshold > 0 && ref && (!f.unit || f.unit === unit)) {
    const pct = ((price - ref) / ref) * 100;
    if (Math.abs(pct) >= s.threshold && (s.direction === 'both' || (s.direction === 'up' ? pct > 0 : pct < 0))) {
      out.push({ ...base, key: `move:${f.lang}:${f.cardId}:${ref}`, kind: 'move', from: ref, pct });
    }
  }
  return out;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Service worker minimal (sans cache) : Android n'affiche les notifications que par ce biais. */
async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration(`${BASE}/`))
      ?? (await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }));
  } catch { return null; }
}

async function showNotification(title: string, opts: NotificationOptions) {
  const reg = await swRegistration();
  if (reg) {
    try {
      const ready = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
      if (ready) { await ready.showNotification(title, opts); return; }
    } catch { /* repli ci-dessous */ }
  }
  try { new Notification(title, opts); } catch { /* notifications indisponibles dans ce contexte */ }
}

let running: Promise<PriceAlert[]> | null = null;

/** Vérifie les cours des favoris (au plus toutes les 30 min, sauf `force`). */
export function checkAlerts(force = false): Promise<PriceAlert[]> {
  const s = getSettings();
  if (!s.enabled) return Promise.resolve([]);
  const st = readState();
  if (!force && Date.now() - st.checkedAt < EVERY) return Promise.resolve(currentAlerts());
  if (running) return running;
  running = (async () => {
    const favs = getFavorites().slice(0, 80);
    const alerts: PriceAlert[] = [];
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (i < favs.length) {
        const f = favs[i++];
        if (!f.targetBelow && !f.targetAbove && !(f.refPrice ?? f.priceAtAdd)) continue;
        const card = await getCard(f.cardId, f.lang).catch(() => null);
        const p = card && priceFor(card, 'normal');
        if (p) alerts.push(...evaluate(f, p.value, p.unit, s));
      }
    }));
    const order: Record<AlertKind, number> = { below: 0, above: 1, move: 2 };
    alerts.sort((a, b) => order[a.kind] - order[b.kind] || Math.abs(b.pct) - Math.abs(a.pct));
    const fresh = alerts.filter((a) => !st.notified.includes(a.key));
    if (s.notify && fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const fmt = (v: number, u: 'EUR' | 'USD') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: u }).format(v);
      await showNotification(fresh.length === 1 ? 'Alerte HoloDex' : `${fresh.length} alertes HoloDex`, {
        body: fresh.slice(0, 3).map((a) => alertText(a, fmt)).join('\n'),
        icon: new URL(`${BASE}/favicon.svg`, location.href).href,
        tag: 'holocote-alerts',
      });
    }
    write(STATE_KEY, { checkedAt: Date.now(), alerts, notified: [...new Set([...st.notified, ...alerts.map((a) => a.key)])].slice(-300) });
    window.dispatchEvent(new CustomEvent(EVENT));
    return alerts;
  })().finally(() => { running = null; });
  return running;
}

/**
 * « J'ai vu » : une alerte de variation prend le cours actuel comme nouvelle référence ;
 * une alerte de prix cible ou de plafond est atteinte, la cible est retirée.
 */
export function acknowledge(alerts: PriceAlert[] = currentAlerts()) {
  setRefPrices(alerts.filter((a) => a.kind === 'move').map((a) => ({ cardId: a.cardId, lang: a.lang, price: a.to })));
  for (const a of alerts.filter((x) => x.kind !== 'move')) {
    const f = getFavorites().find((x) => x.cardId === a.cardId && x.lang === a.lang);
    if (f) setTargets(f.cardId, f.lang, { below: a.kind === 'below' ? undefined : f.targetBelow, above: a.kind === 'above' ? undefined : f.targetAbove });
  }
  const st = readState();
  write(STATE_KEY, { ...st, alerts: st.alerts.filter((x) => !alerts.some((a) => a.key === x.key)) });
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Après la modification d'une cible : relancer une vérification rapide. */
export function recheckSoon() {
  write(STATE_KEY, { ...readState(), checkedAt: 0 });
  checkAlerts(true).catch(() => {});
}
