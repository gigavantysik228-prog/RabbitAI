// Rabbit AI — сервис-воркер: быстрая загрузка и работа без интернета (страница-заглушка).
const V = "rabbit-v3";
const CORE = ["/", "/index.html", "/style.css", "/app.js", "/files.js", "/theme.js", "/favicon.svg", "/bunny.svg", "/bunny-swag.svg", "/logo-swag.svg", "/offline.html", "/icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/download/")) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("/offline.html") : Response.error())))
  );
});
