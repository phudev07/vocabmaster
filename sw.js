// Import OneSignal Service Worker SDK
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'vocabmaster-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './js/storage.js',
    './js/firebase.js',
    './js/srs.js',
    './js/speech.js',
    './js/stats.js',
    './js/topics.js',
    './js/vocabulary.js',
    './js/review.js',
    './js/test.js',
    './js/app.js'
];

// Install - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip Firebase and external requests
    if (event.request.url.includes('firebase') || 
        event.request.url.includes('gstatic') ||
        event.request.url.includes('googleapis')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache the new response
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Fallback to cache
                return caches.match(event.request);
            })
    );
});

// Push notification handler
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'VocabMaster';
    const options = {
        body: data.body || 'Đã đến lúc ôn tập từ vựng!',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || './'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url || './')
    );
});
