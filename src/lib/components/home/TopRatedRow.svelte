<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let topRatedMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/movies/top-rated?limit=20', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				if (data.movies && Array.isArray(data.movies)) {
					topRatedMovies = data.movies;
				}
			}
		} catch (error) {
			console.error('Failed to fetch top rated movies:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && topRatedMovies.length > 0}
	<MovieScrollContainer title="Top Rated" movies={topRatedMovies} />
{/if}
