/* FCM фоновые уведомления (веб). Версия SDK — как в vite-plugin-firebase-sw-init.ts (FIREBASE_JS_CDN_VERSION). */
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js",
);
importScripts("/firebase-sw-init.js");

if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0) {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification;
    const title = (n && n.title) || "PING MOOT";
    const body = (n && n.body) || "";
    return self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      data: payload.data || {},
    });
  });
}
