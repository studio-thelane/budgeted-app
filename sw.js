const CACHE_NAME = 'budgeted-ganaxlebuli-v4';

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

let messaging;
try {
    if (firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
        messaging.onBackgroundMessage((payload) => {
            console.log('Received background message ', payload);
            const notificationTitle = payload.notification.title || 'ბიუჯეტი - ახალი აქტივობა';
            const notificationOptions = {
                body: payload.notification.body,
                icon: 'icons/icon-192x192.png',
                badge: 'icons/icon-192x192.png'
            };
            self.registration.showNotification(notificationTitle, notificationOptions);
        });
    }
} catch (e) {
    console.error('FCM initialization error in SW:', e);
}

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Basic fetch handler to satisfy PWA requirements
});

self.addEventListener('push', function(event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch(e) {
        data = { body: event.data ? event.data.text() : "" };
    }
    const title = data.title || "Budgeted Studio";
    const options = {
        body: data.body || "ახალი ტრანზაქცია გატარდა",
        icon: "icons/icon-192x192.png",
        badge: "icons/icon-192x192.png",
        vibrate: [100, 50, 100]
    };
    event.waitUntil(self.registration.showNotification(title, options));
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
