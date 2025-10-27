self.addEventListener("install", (e) => {
  console.log("Service Worker: install");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  console.log("Service Worker: activate");
  return self.clients.claim();
});

// Offline fallback (минимальный)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.open("planner365-v2").then((cache) =>
      cache.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((resp) => {
          if (event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, resp.clone());
          }
          return resp;
        })
      )
    )
  );
});