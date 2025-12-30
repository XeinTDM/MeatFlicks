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

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
	<div class="max-w-md w-full">
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-20 h-20 bg-slate-700 rounded-full mb-6">
				<Wifi class="w-10 h-10 text-slate-400" />
			</div>
			<h1 class="text-3xl font-bold mb-2">You're Offline</h1>
			<p class="text-slate-400 text-lg">No internet connection detected</p>
		</div>

		<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-700">
			<p class="text-slate-300 mb-6 leading-relaxed">
				Don't worry! You can still enjoy MeatFlicks with your saved content. Your watchlist and viewing history are available offline.
			</p>

			<div class="space-y-3 mb-6">
				<h3 class="font-semibold text-white mb-3">Available Offline:</h3>
				<div class="grid grid-cols-1 gap-3">
					<div class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
						<Home class="w-5 h-5 text-blue-400" />
						<span class="text-slate-200">Browse home page</span>
					</div>
					<div class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
						<Heart class="w-5 h-5 text-red-400" />
						<span class="text-slate-200">View your watchlist</span>
					</div>
					<div class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
						<Search class="w-5 h-5 text-green-400" />
						<span class="text-slate-200">Search saved content</span>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<button
					onclick={handleRetryConnection}
					disabled={isReconnecting}
					class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
				>
					{#if isReconnecting}
						<RefreshCw class="w-5 h-5 animate-spin" />
						Reconnecting...
					{:else}
						<Wifi class="w-5 h-5" />
						Try Again
					{/if}
				</button>

				<div class="grid grid-cols-3 gap-2">
					<button
						onclick={goHome}
						class="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
					>
						<Home class="w-4 h-4" />
						Home
					</button>
					<button
						onclick={goToSearch}
						class="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
					>
						<Search class="w-4 h-4" />
						Search
					</button>
					<button
						onclick={goToWatchlist}
						class="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
					>
						<Heart class="w-4 h-4" />
						Watchlist
					</button>
				</div>
			</div>
		</div>

		<div class="text-center">
			<p class="text-slate-500 text-sm">
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
