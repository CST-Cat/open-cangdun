/* 苍盾题库 Service Worker：离线可刷 + 二次进入零网络
   策略：/data/*、/fonts/* → SWR（先回缓存，后台更新）
        导航/JS/CSS → 网络优先，离线回退缓存
        /data/images/* → cache-first（内容不可变） */
const VERSION = 'cd-v1'
const SWR_CACHE = `${VERSION}-swr`
const IMG_CACHE = `${VERSION}-img`
const SHELL_CACHE = `${VERSION}-shell`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll([
    '/', '/index.html', '/favicon.svg',
  ])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  )
})

// 精确匹配 URL 的 SWR：立即回缓存副本，同时后台刷新
async function swr(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const refresh = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone())
    return res
  }).catch(() => null)
  return cached ?? (await refresh) ?? Response.error()
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const cached = await cache.match(request)
    return cached ?? Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  if (url.pathname.startsWith('/data/images/')) {
    e.respondWith(cacheFirst(request, IMG_CACHE))
  } else if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(swr(request, SWR_CACHE))
  } else if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request, SHELL_CACHE))
  } else if (/\.(js|css|svg|woff2?|png)$/.test(url.pathname)) {
    e.respondWith(swr(request, SHELL_CACHE))
  }
})
