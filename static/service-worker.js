const CACHE_NAME = 'meatflicks-v2';
const STATIC_CACHE = 'meatflicks-static-v2';
const API_CACHE = 'meatflicks-api-v2';
const IMAGE_CACHE = 'meatflicks-images-v2';

const STATIC_ASSETS = [
	'/',
	'/favicon.png',
	'/manifest.json',
	'/app.css',
	'/robots.txt'
];

const CACHE_STRATEGIES = {
	NETWORK_FIRST: 'network-first',
	CACHE_FIRST: 'cache-first',
	STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
	CACHE_ONLY: 'cache-only'
};

const CACHEABLE_ROUTES = [
	{ pattern: /^\/$/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
	{ pattern: /^\/app\.css$/, strategy: CACHE_STRATEGIES.CACHE_FIRST },
	{ pattern: /\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/i, strategy: CACHE_STRATEGIES.CACHE_FIRST },
	{ pattern: /^\/api\/genres/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
	{ pattern: /^\/api\/home-library/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
	{ pattern: /^\/api\/search\/autocomplete/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE }
];

const OFFLINE_FALLBACKS = {
	'/': '/offline.html'
};

self.addEventListener('install', (event) => {
	event.waitUntil(
		Promise.all([
			caches.open(STATIC_CACHE).then((cache) => {
				return cache.addAll(STATIC_ASSETS).catch((error) => {
					console.warn('[SW] Failed to cache some static assets:', error);
				});
			}),
			caches.open(API_CACHE),
			caches.open(IMAGE_CACHE)
		]).then(() => {
			self.skipWaiting();
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches.keys().then((cacheNames) => {
				return Promise.all(
					cacheNames
						.filter((name) => !name.startsWith('meatflicks-'))
						.map((name) => {
							console.log('[SW] Deleting old cache:', name);
							return caches.delete(name);
						})
				);
			}),
			self.clients.claim()
		]).then(() => {
			// Ignore
		})
	);
});

self.addEventListener('sync', (event) => {
	console.log('[SW] Background sync triggered:', event.tag);

	if (event.tag === 'sync-watchlist') {
		event.waitUntil(syncWatchlist());
	}
});

self.addEventListener('push', (event) => {
	console.log('[SW] Push notification received');

	if (event.data) {
		const data = event.data.json();
		const options = {
			body: data.body || 'New content available!',
			icon: '/favicon.png',
			badge: '/favicon.png',
			vibrate: [100, 50, 100],
			data: data
		};

		event.waitUntil(
			self.registration.showNotification(data.title || 'MeatFlicks', options)
		);
	}
});

self.addEventListener('notificationclick', (event) => {
	console.log('[SW] Notification clicked');
	event.notification.close();

	event.waitUntil(
		clients.openWindow(event.notification.data?.url || '/')
	);
});

function getCacheStrategy(request) {
	const url = new URL(request.url);

	for (const route of CACHEABLE_ROUTES) {
		if (route.pattern.test(url.pathname)) {
			return route.strategy;
		}
	}

	if (url.pathname.startsWith('/api/')) {
		return CACHE_STRATEGIES.NETWORK_FIRST;
	}

	if (/\.(png|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
		return CACHE_STRATEGIES.CACHE_FIRST;
	}

	return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

function getCacheName(strategy, url) {
	if (strategy === CACHE_STRATEGIES.CACHE_FIRST) {
		return STATIC_CACHE;
	}
	if (url.pathname.startsWith('/api/')) {
		return API_CACHE;
	}
	if (/\.(png|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
		return IMAGE_CACHE;
	}
	return STATIC_CACHE;
}

async function handleRequest(request) {
	const url = new URL(request.url);
	const strategy = getCacheStrategy(request);
	const cacheName = getCacheName(strategy, url);

	switch (strategy) {
		case CACHE_STRATEGIES.NETWORK_FIRST:
			return networkFirst(request, cacheName);

		case CACHE_STRATEGIES.CACHE_FIRST:
			return cacheFirst(request, cacheName);

		case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
			return staleWhileRevalidate(request, cacheName);

		case CACHE_STRATEGIES.CACHE_ONLY:
			return caches.match(request);

		default:
			return fetch(request);
	}
}

async function networkFirst(request, cacheName) {
	try {
		const networkResponse = await fetch(request);

		if (networkResponse.ok && networkResponse.status !== 206) {
			const cache = await caches.open(cacheName);
			try {
				await cache.put(request, networkResponse.clone());
			} catch (err) {
				console.warn('[SW] Failed to cache response:', err);
			}
		}

		return networkResponse;
	} catch (error) {
		console.log(`[SW] Network failed, trying cache for: ${request.url}`);
		const cachedResponse = await caches.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

async function cacheFirst(request, cacheName) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok && networkResponse.status !== 206) {
			const cache = await caches.open(cacheName);
			try {
				await cache.put(request, networkResponse.clone());
			} catch (err) {
				console.warn('[SW] Failed to cache response:', err);
			}
		}
		return networkResponse;
	} catch (error) {
		console.log(`[SW] Network failed for: ${request.url}`);
		throw error;
	}
}

async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	const fetchPromise = fetch(request).then(async (networkResponse) => {
		if (networkResponse.ok && networkResponse.status !== 206) {
			try {
				await cache.put(request, networkResponse.clone());
			} catch (err) {
				console.warn('[SW] Failed to background cache response:', err);
			}
		}
		return networkResponse;
	}).catch((error) => {
		console.warn(`[SW] Background refresh failed for: ${request.url}`, error);
	});

	if (cachedResponse) {
		return cachedResponse;
	}

	return fetchPromise;
}

async function syncWatchlist() {
	console.log('[SW] Syncing watchlist changes');

	try {
		const clients = await self.clients.matchAll();
		for (const client of clients) {
			client.postMessage({
				type: 'SYNC_WATCHLIST'
			});
		}
	} catch (error) {
		console.error('[SW] Watchlist sync failed:', error);
	}
}

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
		return;
	}

	const url = new URL(event.request.url);
	if (url.pathname.includes('/api/watchlist') ||
		url.pathname.includes('/api/history') ||
		url.pathname.includes('/api/playback') ||
		url.pathname.match(/^\/(login|signup|logout)/)) {
		return;
	}

	event.respondWith(
		handleRequest(event.request).catch(async (error) => {
			console.warn(`[SW] Request failed for ${event.request.url}:`, error);

			const cachedResponse = await caches.match(event.request);
			if (cachedResponse) {
				console.log(`[SW] Serving cached fallback for: ${event.request.url}`);
				return cachedResponse;
			}

			if (event.request.mode === 'navigate') {
				const offlineResponse = await caches.match('/offline.html');
				if (offlineResponse) {
					return offlineResponse;
				}
			}

			return new Response(
				JSON.stringify({
					error: 'Offline',
					message: 'You appear to be offline. Please check your connection.'
				}),
				{
					status: 503,
					statusText: 'Service Unavailable',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		})
	);
});
