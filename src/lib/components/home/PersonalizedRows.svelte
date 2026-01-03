<script lang="ts">
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let historyEntries = $derived($watchHistory.entries.slice(0, 10));
	let watchlistEntries = $derived(watchlist.items.slice(0, 10));

	let hasMounted = $state(false);
	onMount(() => {
		hasMounted = true;
	});

	function toLibraryMovie(entry: {
		addedAt?: string | null;
		watchedAt?: string | null;
		media_type?: string;
		mediaType?: string;
	}): LibraryMovie {
		return {
			...entry,
			addedAt: entry.addedAt ?? entry.watchedAt ?? null,
			mediaType: entry.media_type ?? entry.mediaType ?? 'movie'
		} as LibraryMovie;
	}

	let libraryHistoryEntries = $derived(historyEntries.map(toLibraryMovie));
	let libraryWatchlistEntries = $derived(watchlistEntries.map(toLibraryMovie));
</script>

{#if hasMounted}
	<div class="space-y-12">
		{#if libraryHistoryEntries.length > 0}
			<MovieScrollContainer title="Recently Viewed" movies={libraryHistoryEntries} />
		{/if}

		{#if libraryWatchlistEntries.length > 0}
			<MovieScrollContainer
				title="Your Watchlist"
				movies={libraryWatchlistEntries}
				linkTo="/watchlist"
			/>
		{/if}
	</div>
{/if}
