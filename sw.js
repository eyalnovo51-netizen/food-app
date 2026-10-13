/* Service worker: מאפשר לאפליקציה לעבוד גם בלי אינטרנט.
   כשמעלים גרסה חדשה של האתר, מעלים את המספר ב-VERSION כדי שהטלפון יקבל את העדכון. */
const VERSION = 'v1';
const CORE_CACHE = 'core-' + VERSION;
const FONT_CACHE = 'fonts';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE_CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CORE_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // דף ראשי: קודם מהרשת (כדי לקבל עדכונים), ואם אין רשת או שהיא איטית, מהמטמון
  if (url.origin === location.origin && req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))
        ]);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // שאר הקבצים של האתר: מהמטמון, ואם אין אז מהרשת
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CORE_CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // פונטים של גוגל: נשמרים אחרי הטעינה הראשונה
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
