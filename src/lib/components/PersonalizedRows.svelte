<script lang="ts">
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import MovieScrollContainer from './MovieScrollContainer.svelte';
	import { onMount } from 'svelte';

	let historyEntries = $derived($watchHistory.entries.slice(0, 10));
	let watchlistEntries = $derived($watchlist.watchlist.slice(0, 10));

	let hasMounted = $state(false);
	onMount(() => {
		hasMounted = true;
	});
</script>

{#if hasMounted}
	<div class="space-y-12">
		{#if historyEntries.length > 0}
			<MovieScrollContainer title="Continue Watching" movies={historyEntries} />
		{/if}

		{#if watchlistEntries.length > 0}
			<MovieScrollContainer title="Your Watchlist" movies={watchlistEntries} linkTo="/watchlist" />
		{/if}
	</div>
{/if}
