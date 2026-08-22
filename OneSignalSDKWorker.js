importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Keep the PWA shell available while OneSignal handles push events.
const CACHE_NAME = 'vocabmaster-v2';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './js/storage.js',
    './js/firebase.js',
    './js/auth.js',
    './js/security.js',
    './js/srs.js',
    './js/speech.js',
    './js/stats.js',
    './js/topics.js',
    './js/vocabulary.js',
    './js/review.js',
    './js/test.js',
    './js/badges.js',
    './js/achievements.js',
    './js/leaderboard.js',
    './js/chat.js',
    './js/admin.js',
    './js/import.js',
    './js/privateChat.js',
    './js/challenges.js',
    './js/notifications.js',
    './js/explore.js',
    './js/app.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Never cache Firebase, OneSignal, CDN, or non-GET requests.
    if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
