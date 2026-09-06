/* Service worker Studio EMVAS: notifiche push e apertura dei link. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Studio EMVAS", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Preferisce una finestra già aperta sull'app: la mette a fuoco e la porta al link della notifica.
      // navigate() può fallire (finestra non controllata dal service worker): in quel caso apre una nuova finestra.
      const client = clients.find((c) => "focus" in c && "navigate" in c);
      if (!client) return self.clients.openWindow(url);
      return client
        .focus()
        .then((c) => (c || client).navigate(url))
        .catch(() => self.clients.openWindow(url));
    })
  );
});
