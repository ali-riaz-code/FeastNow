// Minimal service worker: qualifies the app as installable. Full offline
// support is out of scope for Phase 1 (spec §5).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
