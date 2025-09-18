self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('railsight-landing-v2').then(c=>c.addAll(['/','/index.html','/manifest.json'])));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});