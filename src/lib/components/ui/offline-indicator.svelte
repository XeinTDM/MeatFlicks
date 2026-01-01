<script lang="ts">
	import { onMount } from 'svelte';
	import { WifiOff, RefreshCw } from '@lucide/svelte';
	import { Button } from './button';

	let isOnline = $state(navigator.onLine);
	let isReconnecting = $state(false);
	let lastCheck = $state(Date.now());

	function updateOnlineStatus() {
		isOnline = navigator.onLine;
		lastCheck = Date.now();
	}

	function handleRetryConnection() {
		if (isReconnecting) return;

		isReconnecting = true;

		fetch(window.location.origin + '/favicon.png', {
			method: 'HEAD',
			cache: 'no-cache',
			mode: 'no-cors'
		})
			.then(() => {
				isOnline = true;
				isReconnecting = false;
				setTimeout(() => {
					window.location.reload();
				}, 500);
			})
			.catch(() => {
				isOnline = false;
				isReconnecting = false;
			})
			.finally(() => {
				setTimeout(() => {
					isReconnecting = false;
				}, 3000);
			});
	}

	onMount(() => {
		window.addEventListener('online', updateOnlineStatus);
		window.addEventListener('offline', updateOnlineStatus);

		const interval = setInterval(() => {
			if (!isOnline && Date.now() - lastCheck > 30000) {
				handleRetryConnection();
			}
		}, 30000);

		return () => {
			window.removeEventListener('online', updateOnlineStatus);
			window.removeEventListener('offline', updateOnlineStatus);
			clearInterval(interval);
		};
	});
</script>

{#if !isOnline}
	<div class="fixed top-4 right-4 z-50 animate-in duration-300 slide-in-from-top-2">
		<div
			class="max-w-sm rounded-lg border border-destructive/20 bg-destructive/95 p-3 shadow-lg backdrop-blur-sm"
		>
			<div class="flex items-center gap-3">
				<div class="flex-shrink-0">
					{#if isReconnecting}
						<RefreshCw class="text-destructive-foreground size-5 animate-spin" />
					{:else}
						<WifiOff class="text-destructive-foreground size-5" />
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p class="text-destructive-foreground text-sm font-medium">
						{#if isReconnecting}
							Reconnecting...
						{:else}
							You're offline
						{/if}
					</p>
					<p class="text-destructive-foreground/70 text-xs">Some features may be limited</p>
				</div>

				{#if !isReconnecting}
					<Button
						variant="ghost"
						size="sm"
						class="text-destructive-foreground hover:bg-destructive-foreground/10 h-8 px-2"
						onclick={handleRetryConnection}
					>
						Retry
					</Button>
				{/if}
			</div>
		</div>
	</div>
{:else if isReconnecting}
	<div class="fixed top-4 right-4 z-50 animate-in duration-300 slide-in-from-top-2">
		<div
			class="rounded-lg border border-yellow-500/20 bg-yellow-500/95 p-3 shadow-lg backdrop-blur-sm"
		>
			<div class="flex items-center gap-3">
				<RefreshCw class="size-5 animate-spin text-yellow-900" />
				<div class="flex-1">
					<p class="text-sm font-medium text-yellow-900">Reconnecting...</p>
				</div>
			</div>
		</div>
	</div>
{/if}
