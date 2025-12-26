<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Progress } from '$lib/components/ui/progress';
	import { ChevronDown, ChevronUp, Check, Clock } from '@lucide/svelte';
	import EpisodeTracker from './EpisodeTracker.svelte';
	import type { Season, SeasonWatchStatus, Episode, EpisodeWatchStatus } from '$lib/types/tv-show';

	interface Props {
		season: Season;
		watchStatus?: SeasonWatchStatus | null;
		episodes: Episode[];
		episodeWatchStatuses: Record<number, EpisodeWatchStatus>;
		tvShowTmdbId: number;
		onWatchStatusChange?: (episodeId: number, watched: boolean) => Promise<void>;
		onProgressUpdate?: (episodeId: number, watchTime: number, totalTime: number) => Promise<void>;
		onPlayEpisode?: (episode: Episode, watchStatus?: EpisodeWatchStatus | null) => void;
		disabled?: boolean;
		isExpanded?: boolean;
		onToggleExpanded?: (seasonNumber: number) => void;
	}

	let {
		season,
		watchStatus,
		episodes,
		episodeWatchStatuses,
		tvShowTmdbId,
		onWatchStatusChange,
		onProgressUpdate,
		onPlayEpisode,
		disabled = false,
		isExpanded = false,
		onToggleExpanded
	}: Props = $props();

	let expanded = $state(isExpanded);

	function toggleExpanded() {
		if (onToggleExpanded) {
			onToggleExpanded(season.seasonNumber);
		} else {
			expanded = !expanded;
		}
	}

	function handlePlayEpisode(
		event: CustomEvent<{ episode: Episode; watchStatus?: EpisodeWatchStatus | null }>
	) {
		if (onPlayEpisode) {
			onPlayEpisode(event.detail.episode, event.detail.watchStatus);
		}
	}

	let progress = $state(0);
	let isCompleted = $state(false);
	let completedAt = $state<string | null>(null);

	$effect(() => {
		progress = watchStatus
			? Math.round((watchStatus.episodesWatched / watchStatus.totalEpisodes) * 100)
			: 0;
		isCompleted = watchStatus?.completedAt !== null;
		completedAt = watchStatus?.completedAt
			? new Date(watchStatus.completedAt).toLocaleDateString()
			: null;
	});
</script>

<Card class="mb-4">
	<CardHeader class="pb-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<CardTitle class="text-lg font-semibold">
					{season.name}
				</CardTitle>
				<Badge variant="secondary" class="text-xs">
					{episodes.length} Episodes
				</Badge>
				{#if isCompleted}
					<Badge variant="default" class="border-green-200 bg-green-100 text-green-800">
						<Check class="mr-1 h-3 w-3" />
						Completed
					</Badge>
				{:else if progress > 0}
					<Badge variant="secondary" class="border-orange-200 bg-orange-100 text-orange-800">
						<Clock class="mr-1 h-3 w-3" />
						In Progress
					</Badge>
				{:else}
					<Badge variant="outline">Not Started</Badge>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if season.airDate}
					<span class="text-sm text-muted-foreground">
						Aired: {new Date(season.airDate).toLocaleDateString()}
					</span>
				{/if}
				<Button variant="ghost" size="sm" onclick={toggleExpanded} class="ml-2">
					{#if expanded}
						<ChevronUp class="h-4 w-4" />
					{:else}
						<ChevronDown class="h-4 w-4" />
					{/if}
				</Button>
			</div>
		</div>
	</CardHeader>

	{#if watchStatus && (progress > 0 || isCompleted)}
		<CardContent class="pb-3">
			<div class="space-y-2">
				<div class="flex justify-between text-sm">
					<span>Season Progress</span>
					<span>{watchStatus.episodesWatched} / {watchStatus.totalEpisodes} episodes</span>
				</div>
				<Progress value={progress} class="h-2" />
				{#if isCompleted && completedAt}
					<p class="mt-1 text-xs text-muted-foreground">
						Completed on {completedAt}
					</p>
				{/if}
			</div>
		</CardContent>
	{/if}

	{#if expanded}
		<CardContent class="pt-0">
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each episodes as episode (episode.id)}
					<EpisodeTracker
						{episode}
						watchStatus={episodeWatchStatuses[episode.id] || null}
						{tvShowTmdbId}
						seasonNumber={season.seasonNumber}
						{onWatchStatusChange}
						{onProgressUpdate}
						on:playEpisode={handlePlayEpisode}
						{disabled}
					/>
				{/each}
			</div>
		</CardContent>
	{/if}
</Card>
