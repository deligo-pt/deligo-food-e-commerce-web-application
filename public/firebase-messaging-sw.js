importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyC3hOXv8j35pLWPrPOKwPO9nnP6TNVGi7g",
  authDomain: "deligo-a196c.firebaseapp.com",
  projectId: "deligo-a196c",
  storageBucket: "deligo-a196c.firebasestorage.app",
  messagingSenderId: "256376229566",
  appId: "1:256376229566:web:7f0226f21eba0ec99118ef",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title;
  const body = payload.notification?.body || payload.data?.body;
  const { orderId, channelId } = payload.data || {};

  const url = channelId === "order_notification" ? "/orders/" + orderId : "/";

  const notificationTitle = title || "New Notification";
  const notificationOptions = {
    body: body || "You have a new notification",
    icon: "/deligoLogo.png",
    badge: "/deligoLogo.png",
    tag: orderId || "deligo-notification",
    data: { url },
    vibrate: [200, 100, 200],
  };
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "NOTIFICATION_RECEIVED" });
      });
    });

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).pathname === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
