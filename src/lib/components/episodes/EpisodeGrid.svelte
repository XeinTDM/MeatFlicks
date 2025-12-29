<script lang="ts">
	import type { Episode } from '$lib/components/episodes/episodeService.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

	let {
		episodes,
		selectedEpisode,
		selectedSeason,
		seasons,
		isLoading,
		onSeasonChange,
		onEpisodeSelect
	} = $props<{
		episodes: Episode[];
		selectedEpisode: number;
		selectedSeason: number;
		seasons: {
			id: number;
			name: string;
			seasonNumber: number;
			episodeCount: number;
			posterPath: string | null;
		}[];
		isLoading: boolean;
		onSeasonChange: (value: string) => void;
		onEpisodeSelect: (episodeNumber: number) => void;
	}>();
</script>

<section class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-xl font-semibold">Episodes</h3>
		<Select type="single" value={selectedSeason.toString()} onValueChange={onSeasonChange}>
			<SelectTrigger class="w-48" aria-label="Select season">
				<span data-slot="select-value">
					{#if seasons?.find((s: { seasonNumber: number }) => s.seasonNumber === selectedSeason)}
						{seasons.find((s: { seasonNumber: number }) => s.seasonNumber === selectedSeason)?.name}
						({seasons.find((s: { seasonNumber: number }) => s.seasonNumber === selectedSeason)
							?.episodeCount} Episodes)
					{/if}
				</span>
			</SelectTrigger>
			<SelectContent>
				{#each seasons as season (season.seasonNumber)}
					<SelectItem value={season.seasonNumber.toString()}>
						{season.name} ({season.episodeCount} Episodes)
					</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>

	{#if isLoading}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(5) as _, i (i)}
				<Skeleton class="aspect-video rounded-md" />
			{/each}
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each episodes as episode (episode.id)}
				<button
					class="group relative aspect-video overflow-hidden rounded-md border transition-all hover:border-primary {selectedEpisode ===
					episode.episodeNumber
						? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
						: 'border-border'}"
					onclick={() => onEpisodeSelect(episode.episodeNumber)}
				>
					{#if episode.stillPath}
						<img
							src={episode.stillPath}
							alt={episode.name}
							class="h-full w-full object-cover transition-transform group-hover:scale-110"
						/>
					{/if}
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
					></div>
					<div class="absolute right-2 bottom-2 left-2 text-left">
						<p class="line-clamp-1 text-xs font-medium text-white">
							E{episode.episodeNumber}: {episode.name}
						</p>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</section>
