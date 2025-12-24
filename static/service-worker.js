const CACHE_NAME = 'meatflicks-v1';
const STATIC_ASSETS = [
	'/',
	'/favicon.png',
	'/manifest.json'
];

const OPTIONAL_ASSETS = [
	'/app.css',
	'/assets/*',
	'/fonts/*'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return Promise.all(
				STATIC_ASSETS.map((asset) => {
					return fetch(asset)
						.then((response) => {
							if (response.ok) {
								return cache.put(asset, response);
							}
							console.warn(`Failed to cache asset: ${asset}`);
							return Promise.resolve();
						})
						.catch((error) => {
							console.warn(`Error caching asset ${asset}:`, error);
							return Promise.resolve();
						});
				})
			);
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((name) => caches.delete(name))
			);
		})
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	if (event.request.url.includes('/api/')) {
		return;
	}

	if (event.request.url.includes('/explore/') ||
		event.request.url.includes('/movie/') ||
		event.request.url.includes('/tv/') ||
		event.request.url.includes('/person/') ||
		event.request.url.includes('/search')) {
		return;
	}

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const responseToCache = response.clone();

				if (response.status === 200 &&
					(STATIC_ASSETS.some(asset => event.request.url.endsWith(asset)) ||
					event.request.url.endsWith('.js') ||
					event.request.url.endsWith('.css') ||
					event.request.url.endsWith('.png') ||
					event.request.url.endsWith('.jpg') ||
					event.request.url.endsWith('.jpeg') ||
					event.request.url.endsWith('.svg') ||
					event.request.url.endsWith('.woff') ||
					event.request.url.endsWith('.woff2'))) {
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
				}

				return response;
			})
			.catch((error) => {
				console.warn(`[SW] Network failed for ${event.request.url}:`, error);

				return caches.match(event.request).then((cachedResponse) => {
					if (cachedResponse) {
						console.log(`[SW] Serving from cache: ${event.request.url}`);
						return cachedResponse;
					}

					if (event.request.mode === 'navigate') {
						console.log(`[SW] Serving offline fallback for navigation: ${event.request.url}`);
						return caches.match('/');
					}

					console.warn(`[SW] No cache available for: ${event.request.url}`);
					return new Response('Offline', {
						status: 503,
						statusText: 'Service Unavailable',
						headers: new Headers({
							'Content-Type': 'text/plain'
						})
					});
				});
			})
	);
});
