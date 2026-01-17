<script lang="ts">
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let recentlyAddedItems = $state<LibraryMedia[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/media/recently-added?limit=20', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				// The API currently returns { movies: ... }, we keep it for now but assign to mediaItems
				const items = data.movies || data.media;
				if (items && Array.isArray(items)) {
					recentlyAddedItems = items;
				}
			}
		} catch (error) {
			console.error('Failed to fetch recently added media:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && recentlyAddedItems.length > 0}
	<MediaScrollContainer title="Recently Added" media={recentlyAddedItems} />
{/if}