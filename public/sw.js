// Service Worker para Homelab Control Pro & Radar IT PWA
const CACHE_NAME = 'homelab-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener para notificaciones push en iOS 16.4+ y navegadores modernos
self.addEventListener('push', (event) => {
  let data = {
    title: 'Radar Autónomo IT',
    body: 'Nueva pasantía o empleo part-time detectado.',
    icon: '/apple-touch-icon.png',
    badge: '/icon-192.png',
    url: '/?tab=radar'
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/apple-touch-icon.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/?tab=radar'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Manejador de clic en la notificación: enfocar o abrir la PWA en iPhone
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
