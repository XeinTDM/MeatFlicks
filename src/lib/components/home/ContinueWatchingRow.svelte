<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let continueWatchingMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/playback/progress', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				if (data.continueWatching && Array.isArray(data.continueWatching)) {
					const moviePromises = data.continueWatching.map(async (progress: any) => {
						try {
							const movieResponse = await fetch(`/api/movies/${progress.mediaId}`, {
								credentials: 'include'
							});
							if (movieResponse.ok) {
								const movieData = await movieResponse.json();
								return {
									...movieData.movie,
									progressPercent: (progress.progress / progress.duration) * 100,
									progressSeconds: progress.progress,
									durationSeconds: progress.duration,
									seasonNumber: progress.seasonNumber,
									episodeNumber: progress.episodeNumber
								};
							}
						} catch (error) {
							console.error(`Failed to fetch movie ${progress.mediaId}:`, error);
						}
						return null;
					});

					const movies = await Promise.all(moviePromises);
					continueWatchingMovies = movies.filter((m) => m !== null) as LibraryMovie[];
				}
			} else if (response.status === 401) {
				// User is not authenticated, which is fine - just don't show continue watching
				console.log('User not authenticated for continue watching');
			} else {
				console.error('Failed to fetch continue watching:', response.statusText);
			}
		} catch (error) {
			console.error('Failed to fetch continue watching:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && continueWatchingMovies.length > 0}
	<MovieScrollContainer title="Continue Watching" movies={continueWatchingMovies} />
{/if}
