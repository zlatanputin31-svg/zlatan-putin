// Simple Service Worker for PWA
const CACHE_NAME = 'exampilot-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
});

self.addEventListener('fetch', (event) => {
  // Required for PWA to be considered "installable"
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
