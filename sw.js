/* Cache offline da versão local; não transfere dados de usuários. */
const CACHE = 'nosso-cantinho-v5.0.0';
const ASSETS = [
  './', './index.html', './styles.css?v=5.0.0', './app.js?v=5.0.0', './cloud.js?v=5.0.0', './firebase-config.js?v=5.0.0', './manifest.webmanifest',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/cozinha.svg', './assets/banheiro.svg', './assets/roupas.svg',
  './assets/sala.svg', './assets/quarto.svg', './assets/geral.svg'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('nosso-cantinho-') && key !== CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
