"use strict";
const CACHE="face-xi-v1.0.0",SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.hostname==="upload.wikimedia.org"){event.respondWith(stale(event.request));return}if(url.origin===self.location.origin)event.respondWith(cacheFirst(event.request))});
async function cacheFirst(request){const hit=await caches.match(request);if(hit)return hit;const response=await fetch(request);if(response.ok)(await caches.open(CACHE)).put(request,response.clone());return response}
async function stale(request){const cache=await caches.open(CACHE),hit=await cache.match(request),network=fetch(request).then(response=>{if(response.ok||response.type==="opaque")cache.put(request,response.clone());return response}).catch(()=>hit);return hit||network}
