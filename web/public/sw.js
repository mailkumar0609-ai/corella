// Corella service worker: makes the site installable. It deliberately caches nothing, so users always get
// the latest version and live test results.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
