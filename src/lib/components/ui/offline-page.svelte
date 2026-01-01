<script lang="ts">
	import { onMount } from 'svelte';
	import { Wifi, RefreshCw, Home, Search, Heart } from '@lucide/svelte';

	let isReconnecting = $state(false);

	function handleRetryConnection() {
		if (isReconnecting) return;

		isReconnecting = true;

		fetch(window.location.origin + '/favicon.png', {
			method: 'HEAD',
			cache: 'no-cache',
			mode: 'no-cors'
		})
			.then(() => {
				window.location.reload();
			})
			.catch(() => {
				isReconnecting = false;
			})
			.finally(() => {
				setTimeout(() => {
					isReconnecting = false;
				}, 3000);
			});
	}

	function goHome() {
		window.location.href = '/';
	}

	function goToSearch() {
		window.location.href = '/search';
	}

	function goToWatchlist() {
		window.location.href = '/watchlist';
	}

	onMount(() => {
		const interval = setInterval(() => {
			if (navigator.onLine) {
				handleRetryConnection();
			}
		}, 30000);

		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>MeatFlicks - Offline</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white"
>
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<div class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-700">
				<Wifi class="h-10 w-10 text-slate-400" />
			</div>
			<h1 class="mb-2 text-3xl font-bold">You're Offline</h1>
			<p class="text-lg text-slate-400">No internet connection detected</p>
		</div>

		<div class="mb-6 rounded-2xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
			<p class="mb-6 leading-relaxed text-slate-300">
				Don't worry! You can still enjoy MeatFlicks with your saved content. Your watchlist and
				viewing history are available offline.
			</p>

			<div class="mb-6 space-y-3">
				<h3 class="mb-3 font-semibold text-white">Available Offline:</h3>
				<div class="grid grid-cols-1 gap-3">
					<div class="flex items-center gap-3 rounded-lg bg-slate-700/50 p-3">
						<Home class="h-5 w-5 text-blue-400" />
						<span class="text-slate-200">Browse home page</span>
					</div>
					<div class="flex items-center gap-3 rounded-lg bg-slate-700/50 p-3">
						<Heart class="h-5 w-5 text-red-400" />
						<span class="text-slate-200">View your watchlist</span>
					</div>
					<div class="flex items-center gap-3 rounded-lg bg-slate-700/50 p-3">
						<Search class="h-5 w-5 text-green-400" />
						<span class="text-slate-200">Search saved content</span>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<button
					onclick={handleRetryConnection}
					disabled={isReconnecting}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-600"
				>
					{#if isReconnecting}
						<RefreshCw class="h-5 w-5 animate-spin" />
						Reconnecting...
					{:else}
						<Wifi class="h-5 w-5" />
						Try Again
					{/if}
				</button>

				<div class="grid grid-cols-3 gap-2">
					<button
						onclick={goHome}
						class="flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
					>
						<Home class="h-4 w-4" />
						Home
					</button>
					<button
						onclick={goToSearch}
						class="flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
					>
						<Search class="h-4 w-4" />
						Search
					</button>
					<button
						onclick={goToWatchlist}
						class="flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
					>
						<Heart class="h-4 w-4" />
						Watchlist
					</button>
				</div>
			</div>
		</div>

		<div class="text-center">
			<p class="text-sm text-slate-500">
				Your data will sync automatically when connection is restored.
			</p>
		</div>
	</div>
</div>

<style>
	.backdrop-blur-sm {
		backdrop-filter: blur(4px);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
