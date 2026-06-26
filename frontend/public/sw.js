/**
 * sw.js (Service Worker)
 * 
 * Implementa una estrategia básica de mitigación frente a pérdidas de conexión 
 * (Modo Offline), cacheando los archivos vitales de la aplicación.
 */

const CACHE_NAME = 'pianoflow-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/midiWorker.js',
    // Aquí irían los bundles resultantes de React
];

// 1. Fase de Instalación: Se pre-cachean los archivos estáticos vitales
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando assets para uso offline.');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting();
});

// 2. Fase de Activación: Limpieza de versiones viejas del caché
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log(`[Service Worker] Limpiando caché obsoleto: ${name}`);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Fase de Intercepción de Red (Estrategia: Cache First)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Si el archivo está en caché, lo servimos de inmediato, garantizando acceso offline
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Si no está, lo pedimos a internet
            return fetch(event.request).catch(() => {
                // Si la red está caída y pide una ruta HTML, mostramos el index cacheado
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
