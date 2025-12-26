<script lang="ts">
	import type { MediaType } from '$lib/streaming/streamingService';
	import { Badge } from '$lib/components/ui/badge';
	import { Star, Film } from '@lucide/svelte';

	let {
		title,
		rating,
		releaseYear,
		durationMinutes,
		mediaType,
		imdbId,
		genres,
		posterPath,
		backdropPath,
		trailerUrl
	} = $props<{
		title: string;
		rating: number | null | undefined;
		releaseYear: string | number;
		durationMinutes: number | null | undefined;
		mediaType: MediaType;
		imdbId: string | null | undefined;
		genres: { id: number; name: string }[] | undefined;
		posterPath: string | null | undefined;
		backdropPath: string | null | undefined;
		trailerUrl: string | null | undefined;
	}>();

	const parseReleaseYear = (value: string | number) => {
		if (typeof value === 'number') return value;
		if (!value) return 'N/A';
		const date = new Date(value);
		const year = date.getFullYear();
		return Number.isFinite(year) ? year : 'N/A';
	};

	const formattedReleaseYear = $derived(parseReleaseYear(releaseYear));

	const runtimeLabel = $derived(() => {
		if (!durationMinutes) {
			return mediaType === 'tv' ? 'Runtime varies' : 'N/A';
		}
		return `${durationMinutes} min`;
	});
</script>

<div class="relative mb-8 h-96 w-full">
	{#if backdropPath}
		<img
			src={backdropPath}
			alt={title}
			class="h-full w-full rounded-lg object-cover"
		/>
	{/if}
	<div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent"></div>
	{#if trailerUrl}
		<div class="absolute inset-0 flex items-center justify-center">
			<button
				onclick={() => window.open(trailerUrl!, '_blank', 'noopener,noreferrer')}
				class="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/30"
				aria-label="Play trailer"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="text-white"
				>
					<path d="M8 5v14l11-7z" />
				</svg>
			</button>
		</div>
	{/if}
	<div class="absolute bottom-4 left-4">
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-4">
				<h1 class="text-5xl font-bold text-foreground">{title}</h1>
				{#if rating}
					<div
						class="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1 backdrop-blur-sm"
					>
						<Star class="h-5 w-5 text-blue-500" />
						<span class="font-semibold">{rating.toFixed(1)}</span>
					</div>
				{/if}
				{#if imdbId}
					<a
						href={`https://www.imdb.com/title/${imdbId}/`}
						target="_blank"
						rel="noopener noreferrer"
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-black/20 backdrop-blur-sm transition-colors hover:bg-black/30"
						title="View on IMDb"
					>
						<Film class="h-5 w-5 text-yellow-500" />
					</a>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-4">
				<p class="text-xl text-gray-300">
					{formattedReleaseYear} | {runtimeLabel}
				</p>
				{#if genres?.length}
					<div class="flex flex-wrap gap-2">
						{#each genres as genre (genre.id)}
							<Badge variant="secondary">
								{genre.name}
							</Badge>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
