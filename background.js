// Minimal service worker (kept for MV3 lifecycle). Currently not required for auto-redirect logic.
self.addEventListener('install', (evt) => {
  self.skipWaiting();
});
self.addEventListener('activate', (evt) => {
  clients.claim();
});
