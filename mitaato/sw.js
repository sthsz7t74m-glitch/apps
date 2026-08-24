const CACHE='mitaato-desk-v6';
const STATIC=['./','./index.html','./styles.css','./thumbnail-scroll.css','./version.css','./posting-assistant.css','./app.js','./thumbnail-scroll.js','./article-batch-loader.js','./posting-assistant.js','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.includes('/data/')||url.pathname.includes('/thumbnails/')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{if(event.request.method==='GET'&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request)));
});
