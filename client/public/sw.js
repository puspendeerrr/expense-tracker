/* eslint-env serviceworker */

/**
 * SplitWise service worker.
 *
 * Deliberately minimal: it exists to receive push messages and to focus the right page
 * when one is clicked. It does NOT cache application assets -- a stale cached bundle
 * showing stale financial figures is worse than a network request, and offline support
 * is not something this product claims.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SplitWise', body: event.data.text() };
  }

  const title = payload.title || 'SplitWise';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    // Replaces an earlier notification about the same thing instead of stacking.
    tag: payload.tag || 'splitwise',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/app' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an open tab when one exists; opening a duplicate is disorienting.
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(target).then((navigated) => navigated && navigated.focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
