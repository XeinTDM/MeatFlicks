<script lang="ts">
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let recentlyAddedMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/movies/recently-added?limit=20', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				if (data.movies && Array.isArray(data.movies)) {
					recentlyAddedMovies = data.movies;
				}
			}
		} catch (error) {
			console.error('Failed to fetch recently added movies:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && recentlyAddedMovies.length > 0}
	<MediaScrollContainer title="Recently Added" movies={recentlyAddedMovies} />
{/if}
