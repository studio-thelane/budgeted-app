importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAVSnqQwwYZmRCD5ejl0aFS4to4Z3SB0tw",
  authDomain: "budgeted-studio.firebaseapp.com",
  projectId: "budgeted-studio",
  storageBucket: "budgeted-studio.firebasestorage.app",
  messagingSenderId: "607316127738",
  appId: "1:607316127738:web:639708a7dd1233c10dfe43"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    console.log('Received background message ', payload);
    const notificationTitle = payload.notification.title || "Budgeted Studio";
    const notificationOptions = {
        body: payload.notification.body || "ახალი ტრანზაქცია გატარდა",
        icon: "icons/icon-192x192.png",
        badge: "icons/icon-192x192.png",
        vibrate: [100, 50, 100]
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    // 1. დახურე შეტყობინების ბანერი
    event.notification.close();

    // 2. შეამოწმე გახსნილია თუ არა აპლიკაცია და გახსენი/გააფოკუსე
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // თუ აპლიკაცია უკვე გახსნილია ფონში, ამოწიე ეკრანზე
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // თუ აპლიკაცია დახურულია, გახსენი
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});