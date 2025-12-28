<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	import { playbackStore } from '$lib/state/stores/playbackStore.svelte';

	let continueWatchingMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		const localProgress = playbackStore.getContinueWatching();
		continueWatchingMovies = localProgress;

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

					const serverMovies = (await Promise.all(moviePromises)).filter(
						(m) => m !== null
					) as LibraryMovie[];

					// Combine and deduplicate
					const combined = [...serverMovies];
					localProgress.forEach((local) => {
						const exists = combined.some(
							(s) => s.id === local.id && s.season === local.season && s.episode === local.episode
						);
						if (!exists) {
							combined.push(local);
						}
					});

					continueWatchingMovies = combined;
				}
			} else if (response.status === 401) {
				console.log('User not authenticated for continue watching, using local storage.');
				// Already set from localProgress
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
