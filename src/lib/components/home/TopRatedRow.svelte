<script lang="ts">
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let topRatedItems = $state<LibraryMedia[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/media/top-rated?limit=20', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				const items = data.movies || data.media;
				if (items && Array.isArray(items)) {
					topRatedItems = items;
				}
			}
		} catch (error) {
			console.error('Failed to fetch top rated media:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && topRatedItems.length > 0}
	<MediaScrollContainer title="Top Rated" media={topRatedItems} />
{/if}
