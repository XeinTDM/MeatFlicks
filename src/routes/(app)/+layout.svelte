<script lang="ts">
	import '../../app.css';

	import AppShell from '$lib/components/navigation/Sidebar.svelte';
	import Footer from '$lib/components/navigation/Footer.svelte';
	import GlobalErrorDisplay from '$lib/components/global/GlobalErrorDisplay.svelte';
	import { NotificationPortal } from '$lib/components/global';
	import ThemeContext from '$lib/state/contexts/ThemeContext.svelte';
	import WatchlistContext from '$lib/state/contexts/WatchlistContext.svelte';
	import ErrorContext from '$lib/state/contexts/ErrorContext.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered:', registration);
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}
	});
</script>

<svelte:head>
	<title>MeatFlicks - Your Ultimate Streaming</title>
	<meta
		name="description"
		content="Discover and stream your favorite movies and TV shows on MeatFlicks."
	/>
</svelte:head>

<ModeWatcher />
<ThemeContext>
	<WatchlistContext>
		<ErrorContext>
			<AppShell>
				<div class="flex min-h-svh flex-col text-foreground">
					<slot />
					<Footer />
				</div>
			</AppShell>
			<GlobalErrorDisplay />
			<NotificationPortal />
		</ErrorContext>
	</WatchlistContext>
</ThemeContext>
