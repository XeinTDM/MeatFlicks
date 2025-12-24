<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Progress } from '$lib/components/ui/progress';
	import { Check, Play, Clock } from '@lucide/svelte';
	import type { Episode, EpisodeWatchStatus } from '$lib/types/tv-show';

	interface Props {
		episode: Episode;
		watchStatus?: EpisodeWatchStatus | null;
		tvShowTmdbId: number;
		seasonNumber: number;
		onWatchStatusChange?: (episodeId: number, watched: boolean) => Promise<void>;
		onProgressUpdate?: (episodeId: number, watchTime: number, totalTime: number) => Promise<void>;
		disabled?: boolean;
	}

	let {
		episode,
		watchStatus,
		tvShowTmdbId, // eslint-disable-line @typescript-eslint/no-unused-vars
		seasonNumber, // eslint-disable-line @typescript-eslint/no-unused-vars
		onWatchStatusChange,
		onProgressUpdate, // eslint-disable-line @typescript-eslint/no-unused-vars
		disabled = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		playEpisode: { episode: Episode; watchStatus?: EpisodeWatchStatus | null };
	}>();

	let isLoading = $state(false);
	let progress = $state(0);
	let isWatched = $state(false);
	let watchedAt = $state<string | null>(null);

	$effect(() => {
		progress = watchStatus ? (watchStatus.watchTime / watchStatus.totalTime) * 100 : 0;
		isWatched = watchStatus?.watched || false;
		watchedAt = watchStatus?.completedAt
			? new Date(watchStatus.completedAt).toLocaleDateString()
			: null;
	});

	async function toggleWatched() {
		if (disabled || !onWatchStatusChange) return;

		isLoading = true;
		try {
			const newWatchedStatus = !isWatched;
			await onWatchStatusChange(episode.id, newWatchedStatus);
		} catch (error) {
			console.error('Failed to update watch status:', error);
		} finally {
			isLoading = false;
		}
	}

	function playEpisode() {
		if (disabled) return;
		dispatch('playEpisode', { episode, watchStatus });
	}

	function formatRuntime(minutes: number | null | undefined): string {
		if (!minutes) return 'N/A';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
	}

	function formatWatchTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<Card class="group transition-all duration-200 hover:shadow-lg {disabled ? 'opacity-50' : ''}">
	<CardHeader class="pb-3">
		<div class="flex items-start justify-between">
			<div class="flex-1">
				<CardTitle class="line-clamp-2 text-lg font-semibold">
					E{episode.episodeNumber}: {episode.name}
				</CardTitle>
				{#if episode.airDate}
					<p class="mt-1 text-sm text-muted-foreground">
						Aired: {new Date(episode.airDate).toLocaleDateString()}
					</p>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if episode.runtimeMinutes}
					<Badge variant="secondary" class="text-xs">
						{formatRuntime(episode.runtimeMinutes)}
					</Badge>
				{/if}
				{#if isWatched}
					<Badge variant="default" class="border-green-200 bg-green-100 text-green-800">
						<Check class="mr-1 h-3 w-3" />
						Watched
					</Badge>
				{:else if progress > 0}
					<Badge variant="secondary" class="border-orange-200 bg-orange-100 text-orange-800">
						<Clock class="mr-1 h-3 w-3" />
						In Progress
					</Badge>
				{:else}
					<Badge variant="outline">Unwatched</Badge>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="space-y-4">
		{#if episode.stillPath}
			<div class="relative aspect-video overflow-hidden rounded-md">
				<img
					src={episode.stillPath}
					alt={episode.name}
					class="h-full w-full object-cover transition-transform group-hover:scale-105"
				/>
				<div
					class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<Button
						size="lg"
						variant="secondary"
						class="bg-white/90 text-black hover:bg-white"
						onclick={playEpisode}
						{disabled}
					>
						<Play class="mr-2 h-5 w-5" />
						Play
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex aspect-video items-center justify-center rounded-md bg-muted">
				<Button size="lg" variant="outline" onclick={playEpisode} {disabled}>
					<Play class="mr-2 h-5 w-5" />
					Play
				</Button>
			</div>
		{/if}

		{#if episode.overview}
			<p class="line-clamp-3 text-sm text-muted-foreground">
				{episode.overview}
			</p>
		{/if}

		{#if watchStatus}
			<div class="space-y-2">
				{#if progress > 0 && !isWatched}
					<div class="space-y-1">
						<div class="flex justify-between text-xs text-muted-foreground">
							<span>Progress</span>
							<span>{Math.round(progress)}%</span>
						</div>
						<Progress value={progress} class="h-2" />
						<div class="flex justify-between text-xs text-muted-foreground">
							<span>Watched: {formatWatchTime(watchStatus.watchTime)}</span>
							<span>Total: {formatWatchTime(watchStatus.totalTime)}</span>
						</div>
					</div>
				{/if}

				<div class="flex items-center justify-between border-t pt-2">
					<div class="text-sm text-muted-foreground">
						{#if isWatched && watchedAt}
							Completed on {watchedAt}
						{:else if progress > 0}
							Last watched: {new Date(watchStatus.updatedAt).toLocaleDateString()}
						{/if}
					</div>

					<Button
						size="sm"
						variant={isWatched ? 'outline' : 'default'}
						onclick={toggleWatched}
						disabled={disabled || isLoading}
						class="min-w-24"
					>
						{#if isLoading}
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							></div>
						{:else if isWatched}
							<Check class="mr-2 h-4 w-4" />
							Mark Unwatched
						{:else}
							<Check class="mr-2 h-4 w-4" />
							Mark Watched
						{/if}
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-between border-t pt-2">
				<div class="text-sm text-muted-foreground">Not started yet</div>
				<Button size="sm" variant="default" onclick={playEpisode} {disabled}>
					<Play class="mr-2 h-4 w-4" />
					Start Watching
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		display: box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		box-orient: vertical;
		overflow: hidden;
	}
</style>
