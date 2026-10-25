// Service worker minimal de HoloDex : il sert uniquement à afficher les notifications d'alertes de prix
// (obligatoire sur Android). Il ne met rien en cache et n'intercepte aucune requête.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL('favoris/#alertes', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { await open.focus(); return open.navigate ? open.navigate(target) : undefined; }
    return self.clients.openWindow(target);
  })());
});
