// ═══════════════════════════════════════════════════════════════
// SushiFlow - Service Worker para Push Notifications do Motoboy
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'sushiflow-sw-v1';

// Instala o Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado e pronto para Push Notifications.');
  self.skipWaiting();
});

// Ativa e assume o controle imediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('[SW] Ativo.');
});

// ─── Recebe Push Notification do Servidor ─────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Nova Entrega!', body: event.data?.text() || 'Você tem uma nova rota disponível.' };
  }

  const title = data.title || '🏍️ SushiFlow Driver';
  const options = {
    body: data.body || 'Nova entrega disponível!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'nova-rota',          // Substitui notificação anterior com mesmo tag
    renotify: true,            // Vibra mesmo que já exista a notification antiga
    requireInteraction: true,  // Fica em tela até o motoboy clicar
    vibrate: [300, 100, 300, 100, 500],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'ver', title: '🗺️ Ver Rota' },
      { action: 'ok', title: '✅ Entendido' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Clique na Notificação ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma janela aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
