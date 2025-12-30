<script lang="ts">
	import { onMount } from 'svelte';
	import { Wifi, WifiOff, RefreshCw } from '@lucide/svelte';
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
	<div class="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
		<div class="bg-destructive/95 backdrop-blur-sm border border-destructive/20 rounded-lg p-3 shadow-lg max-w-sm">
			<div class="flex items-center gap-3">
				<div class="flex-shrink-0">
					{#if isReconnecting}
						<RefreshCw class="size-5 text-destructive-foreground animate-spin" />
					{:else}
						<WifiOff class="size-5 text-destructive-foreground" />
					{/if}
				</div>

				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-destructive-foreground">
						{#if isReconnecting}
							Reconnecting...
						{:else}
							You're offline
						{/if}
					</p>
					<p class="text-xs text-destructive-foreground/70">
						Some features may be limited
					</p>
				</div>

				{#if !isReconnecting}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 px-2 text-destructive-foreground hover:bg-destructive-foreground/10"
						onclick={handleRetryConnection}
					>
						Retry
					</Button>
				{/if}
			</div>
		</div>
	</div>
{:else if isReconnecting}
	<div class="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
		<div class="bg-yellow-500/95 backdrop-blur-sm border border-yellow-500/20 rounded-lg p-3 shadow-lg">
			<div class="flex items-center gap-3">
				<RefreshCw class="size-5 text-yellow-900 animate-spin" />
				<div class="flex-1">
					<p class="text-sm font-medium text-yellow-900">
						Reconnecting...
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
