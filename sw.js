/* AvSec Portal — service worker. Оболочка кэшируется целиком: после первого входа портал
   открывается без сети. При правке ЛЮБОГО файла портала поднять V (и ?v= в index.html). */
const V = 'avsec-portal-v18';
const N = V.replace(/\D/g, '');   // номер версии — тот же, что ?v= в index.html
const SHELL = [
  './', './index.html', `./app.js?v=${N}`, `./styles.css?v=${N}`,
  './manifest.webmanifest', './data/config.json', './icon.svg',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V)
    // по одному: один недостающий файл не должен срывать установку
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = req.url;
  // шифрованные данные меняются только вместе с версией портала — кэш вперёд, повторные входы мгновенны
  if (/\/data-enc\/.*\.enc/.test(url)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)
      .then(r2 => { if (r2.ok) { const c = r2.clone(); caches.open(V).then(k => k.put(req, c)); } return r2; })));
    return;
  }
  // config.json и оболочка — сеть вперёд (после деплоя сразу свежая сборка), офлайн — из кэша
  if (req.mode === 'navigate' || /\/data\/config\.json/.test(url) || /\/(index\.html)?(\?.*)?$/.test(url)) {
    e.respondWith(fetch(req)
      .then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(k => k.put(req, c)); } return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)
    .then(r2 => { if (r2.ok) { const c = r2.clone(); caches.open(V).then(k => k.put(req, c)); } return r2; })));
});
