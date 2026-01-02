<script lang="ts">
	import MovieScrollContainer from '$lib/components/media/MovieScrollContainer.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import {
		playbackStore,
		shouldShowInContinueWatching,
		type PlaybackProgress
	} from '$lib/state/stores/playbackStore.svelte';

	let continueWatchingMovies = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	function getMediaKey(id: string | number, season?: number, episode?: number) {
		return `${id}-${season ?? 0}-${episode ?? 0}`;
	}

	onMount(async () => {
		const localProgress = playbackStore.getContinueWatching();
		continueWatchingMovies = localProgress;

		if (!page.data.user) {
			isLoading = false;
			return;
		}

		try {
			const progressRes = await fetch('/api/playback/progress', { credentials: 'include' });
			if (!progressRes.ok) throw new Error(progressRes.statusText);

			const { continueWatching } = await progressRes.json();
			if (!Array.isArray(continueWatching) || continueWatching.length === 0) {
				isLoading = false;
				return;
			}

			const movieIds = [...new Set(continueWatching.map((p: any) => p.mediaId))];
			const moviesRes = await fetch(`/api/movies/batch?ids=${movieIds.join(',')}`, {
				credentials: 'include'
			});
			if (!moviesRes.ok) throw new Error(moviesRes.statusText);

			const { movies: fetchedMovies } = await moviesRes.json();
			const movieLookup = new Map(fetchedMovies.map((m: any) => [m.id, m]));

			const serverMovies = continueWatching
				.map((p: any) => {
					const movie = movieLookup.get(p.mediaId);
					if (!movie) return null;
					return {
						...movie,
						progressPercent: (p.progress / p.duration) * 100,
						progressSeconds: p.progress,
						durationSeconds: p.duration,
						seasonNumber: p.seasonNumber,
						episodeNumber: p.episodeNumber
					};
				})
				.filter(Boolean) as unknown as LibraryMovie[];

			const combinedMap = new Map<string, LibraryMovie>();

			localProgress.forEach((m) => {
				const key = getMediaKey(m.id, (m as any).seasonNumber, (m as any).episodeNumber);
				combinedMap.set(key, m);
			});

			serverMovies.forEach((m) => {
				const key = getMediaKey(m.id, (m as any).seasonNumber, (m as any).episodeNumber);
				combinedMap.set(key, m);
			});

			continueWatchingMovies = Array.from(combinedMap.values())
				.filter((m: any) => {
					const progress: PlaybackProgress = {
						mediaId: m.id.toString(),
						mediaType: (m.mediaType as 'movie' | 'tv' | 'anime') || 'movie',
						progress: m.progressSeconds || 0,
						duration: m.durationSeconds || 0,
						updatedAt: 0
					};
					return shouldShowInContinueWatching(progress);
				})
				.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
		} catch (error) {
			if ((error as any).status !== 401) {
				console.error('[ContinueWatchingRow] Failed to fetch:', error);
			}
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && continueWatchingMovies.length > 0}
	<MovieScrollContainer title="Continue Watching" movies={continueWatchingMovies} />
{/if}
