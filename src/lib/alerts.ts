// Alertes de prix sur les favoris, entièrement dans le navigateur (aucun e-mail, aucun serveur).
// À chaque visite (au plus toutes les 3 heures), on compare le cours actuel de chaque favori
// à son cours de référence ; au-delà du seuil choisi, une alerte s'affiche sur le site.

import { getFavorites, setRefPrices, type Favorite } from './favorites';
import { getCard, priceFor, type Lang } from './tcgdex';

export interface AlertSettings {
  enabled: boolean;
  threshold: number;              // en %
  direction: 'both' | 'up' | 'down';
}

export interface PriceAlert {
  cardId: string;
  lang: Lang;
  name: string;
  image?: string;
  from: number;
  to: number;
  unit: 'EUR' | 'USD';
  pct: number;
}

interface State { checkedAt: number; alerts: PriceAlert[] }

const SETTINGS_KEY = 'holocote.alerts.settings.v1';
const STATE_KEY = 'holocote.alerts.state.v1';
const EVENT = 'holocote:alerts';
const EVERY = 3 * 60 * 60 * 1000;
export const DEFAULT_SETTINGS: AlertSettings = { enabled: true, threshold: 10, direction: 'both' };

function read<T>(key: string): T | null {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* rien */ }
}

export function getSettings(): AlertSettings {
  const s = read<Partial<AlertSettings>>(SETTINGS_KEY) ?? {};
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled,
    threshold: [5, 10, 20, 50].includes(Number(s.threshold)) ? Number(s.threshold) : DEFAULT_SETTINGS.threshold,
    direction: s.direction === 'up' || s.direction === 'down' ? s.direction : 'both',
  };
}

export function setSettings(s: AlertSettings) {
  write(SETTINGS_KEY, s);
  write(STATE_KEY, { checkedAt: 0, alerts: [] }); // nouveau réglage : on recalcule
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function currentAlerts(): PriceAlert[] {
  const st = read<State>(STATE_KEY);
  const favs = getFavorites();
  // On ne garde que les alertes de cartes toujours en favori.
  return (st?.alerts ?? []).filter((a) => favs.some((f) => f.cardId === a.cardId && f.lang === a.lang));
}

export const onAlertsChange = (cb: () => void) => window.addEventListener(EVENT, cb);

let running: Promise<PriceAlert[]> | null = null;

/** Vérifie les cours des favoris (au plus toutes les 3 h, sauf `force`). */
export function checkAlerts(force = false): Promise<PriceAlert[]> {
  const settings = getSettings();
  if (!settings.enabled) return Promise.resolve([]);
  const st = read<State>(STATE_KEY);
  if (!force && st && Date.now() - st.checkedAt < EVERY) return Promise.resolve(currentAlerts());
  if (running) return running;
  running = (async () => {
    const favs = getFavorites().slice(0, 60);
    const alerts: PriceAlert[] = [];
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (i < favs.length) {
        const f: Favorite = favs[i++];
        const ref = f.refPrice ?? f.priceAtAdd;
        if (!ref) continue;
        const card = await getCard(f.cardId, f.lang).catch(() => null);
        const p = card && priceFor(card, 'normal');
        if (!p || (f.unit && p.unit !== f.unit)) continue;
        const pct = ((p.value - ref) / ref) * 100;
        const hit = Math.abs(pct) >= settings.threshold &&
          (settings.direction === 'both' || (settings.direction === 'up' ? pct > 0 : pct < 0));
        if (hit) alerts.push({ cardId: f.cardId, lang: f.lang, name: f.name, image: f.image, from: ref, to: p.value, unit: p.unit, pct });
      }
    }));
    alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    write(STATE_KEY, { checkedAt: Date.now(), alerts });
    window.dispatchEvent(new CustomEvent(EVENT));
    return alerts;
  })().finally(() => { running = null; });
  return running;
}

/** « J'ai vu » : le cours actuel devient la nouvelle référence, l'alerte disparaît. */
export function acknowledge(alerts: PriceAlert[] = currentAlerts()) {
  setRefPrices(alerts.map((a) => ({ cardId: a.cardId, lang: a.lang, price: a.to })));
  const st = read<State>(STATE_KEY);
  const keep = (st?.alerts ?? []).filter((a) => !alerts.some((x) => x.cardId === a.cardId && x.lang === a.lang));
  write(STATE_KEY, { checkedAt: st?.checkedAt ?? Date.now(), alerts: keep });
  window.dispatchEvent(new CustomEvent(EVENT));
}
