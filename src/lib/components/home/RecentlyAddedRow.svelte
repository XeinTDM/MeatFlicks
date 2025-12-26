<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
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
	<MovieScrollContainer title="Recently Added" movies={recentlyAddedMovies} />
{/if}
