<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	import {
		playbackStore,
		shouldShowInContinueWatching,
		type PlaybackProgress
	} from '$lib/state/stores/playbackStore.svelte';

	let continueWatchingMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		const localProgress = playbackStore.getContinueWatching();
		continueWatchingMovies = localProgress;

		if (!$page.data.user) {
			isLoading = false;
			return;
		}

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

					continueWatchingMovies = combined.filter((m) => {
						const movie = m as any;
						const progress: PlaybackProgress = {
							mediaId: movie.id.toString(),
							mediaType: (movie.mediaType as 'movie' | 'tv' | 'anime') || 'movie',
							progress: movie.progressSeconds || 0,
							duration: movie.durationSeconds || 0,
							updatedAt: 0
						};
						return shouldShowInContinueWatching(progress);
					});
				}
			} else if (response.status === 401) {
				// Ignore
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
