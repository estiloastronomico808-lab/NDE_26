'use strict';
// Sube el número de versión cada vez que cambies cualquier archivo de la app,
// para que los dispositivos descarguen la versión nueva.
const VERSION = 'nde2026-v1';
const ARCHIVOS = [
  './',
  'index.html',
  'style.css',
  'sedes.js',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'Banner.png' // opcional: si no existe, no se cachea y no rompe la instalación
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Se agregan de uno en uno para que un archivo faltante (p. ej. Banner.png) no cancele todo.
    await Promise.all(ARCHIVOS.map(async url => {
      try {
        const resp = await fetch(url, { cache: 'reload' });
        if (resp.ok) await cache.put(url, resp);
      } catch (_) { /* se ignora */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google Maps y demás externos: red normal

  // Navegación: red primero con respaldo en caché (así se ven las actualizaciones y funciona offline).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('index.html', resp.clone());
        return resp;
      } catch (_) {
        return (await caches.match('index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Recursos propios: caché primero, red como respaldo.
  event.respondWith((async () => {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    try {
      const resp = await fetch(req);
      if (resp.ok) (await caches.open(VERSION)).put(req, resp.clone());
      return resp;
    } catch (_) {
      return Response.error();
    }
  })());
});
