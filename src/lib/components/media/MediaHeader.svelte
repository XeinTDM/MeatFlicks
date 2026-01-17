<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Star, Film, Play, Bookmark, BookmarkMinus } from '@lucide/svelte';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import { error as errorStore } from '$lib/state/stores/errorStore';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';

	import { getImageUrl } from '$lib/utils/image';

	let {
		movie,
		logoPath,
		providers = [],
		onProviderSelect
	} = $props<{
		movie: {
			id: string;
			title: string;
			backdropPath?: string | null;
			releaseDate?: string | number | null;
			rating?: number | null;
			overview?: string | null;
			trailerUrl?: string | null;
			mediaType?: string;
			durationMinutes?: number;
			currentEpisodeRuntime?: number;
			episodeRuntimes?: number[];
			genres?: { id: number; name: string }[];
		};
		logoPath?: string | null;
		providers?: ProviderResolution[];
		onProviderSelect?: (providerId: string) => void;
	}>();

	const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);
	const backdropUrl = $derived(getImageUrl(movie?.backdropPath, 'w1280'));
	const logoUrl = $derived(getImageUrl(logoPath, 'w500'));

	function handleWatchlistToggle() {
		if (!movie) return;
		try {
			if (isInWatchlist) {
				watchlist.removeFromWatchlist(movie.id);
			} else {
				watchlist.addToWatchlist(movie);
			}
		} catch (err) {
			console.error('Failed to update watchlist:', err);
			errorStore.set('Failed to update watchlist. Please try again.');
		}
	}

	const parseReleaseYear = (value: string | number | null | undefined) => {
		if (typeof value === 'number') return value;
		if (!value) return 'N/A';
		const date = new Date(value);
		const year = date.getFullYear();
		return Number.isFinite(year) ? year : 'N/A';
	};

	const formattedReleaseYear = $derived(parseReleaseYear(movie?.releaseDate));

	function getRuntimeLabel() {
		if (!movie) return null;
		if (movie.mediaType === 'movie') {
			return movie.durationMinutes ? `${movie.durationMinutes} min` : 'N/A';
		}

		if (movie.currentEpisodeRuntime) {
			return `${movie.currentEpisodeRuntime} min`;
		}

		if (movie.episodeRuntimes && movie.episodeRuntimes.length > 0) {
			const min = Math.min(...movie.episodeRuntimes);
			const max = Math.max(...movie.episodeRuntimes);

			if (min === max) {
				return `${min} min`;
			} else {
				return `${min}-${max} min`;
			}
		}

		if (movie.durationMinutes) {
			return `${movie.durationMinutes} min`;
		}

		return null;
	}

	const runtimeLabel = $derived(getRuntimeLabel());

	let showFullOverview = $state(false);

	function toggleOverview() {
		showFullOverview = !showFullOverview;
	}
</script>

<div class="relative mb-8 h-[70vh] w-full overflow-hidden">
	<div class="absolute top-0 -right-[5%] -left-[5%] h-full w-[calc(100%+10%)]">
		{#if movie?.backdropPath}
			<img
				src={backdropUrl}
				alt={movie.title}
				class="h-full w-full rounded-lg object-cover"
			/>
		{/if}
		<div
			class="absolute inset-0 rounded-lg bg-linear-to-t from-background via-background/60 to-transparent"
		></div>
	</div>

	<div class="relative z-10 h-full">
		<div class="absolute bottom-[20%] ml-[10%] max-w-4xl">
			<div class="flex flex-col gap-6">
				{#if logoPath}
					<img src={logoUrl} alt={movie.title} class="h-32 w-auto origin-left object-contain" />
				{:else}
					<h1 class="text-6xl font-extrabold tracking-tight text-foreground">{movie?.title}</h1>
				{/if}

				<div class="flex items-center gap-4 text-lg">
					{#if movie?.rating}
						<div class="flex items-center gap-2 text-yellow-500">
							<Star class="size-6 fill-current" />
							<span class="font-bold text-foreground">{movie.rating.toFixed(1)}</span>
						</div>
					{/if}

					<div class="flex items-center gap-3 text-muted-foreground">
						<span>{formattedReleaseYear}</span>
						{#if runtimeLabel}
							<span>•</span>
							<span>{runtimeLabel}</span>
						{/if}
						{#if movie?.genres?.length}
							<span>•</span>
							<div class="flex gap-2">
								{#each movie.genres.slice(0, 3) as genre (genre.id)}
									<span>{genre.name}</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				{#if movie?.overview}
					<div class="max-w-2xl">
						{#if showFullOverview}
							<p class="text-lg leading-relaxed text-muted-foreground">
								{movie.overview}
							</p>
						{:else}
							<p class="line-clamp-1 text-lg leading-relaxed text-muted-foreground">
								{movie.overview}
							</p>
						{/if}
						{#if movie.overview.length > 100}
							<Button
								variant="link"
								class="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
								onclick={toggleOverview}
							>
								{#if showFullOverview}
									Less
								{:else}
									More
								{/if}
							</Button>
						{/if}
					</div>
				{/if}

				<div class="mt-2 flex flex-wrap items-center gap-4">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button
								variant="default"
								size="lg"
								class="h-12 gap-2 bg-primary px-8 text-lg font-semibold hover:bg-primary/90"
							>
								<Play class="size-5 fill-current" />
								Play
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start" class="w-56">
							{#if providers.length > 0}
								<DropdownMenu.Label>Select Provider</DropdownMenu.Label>
								<DropdownMenu.Separator />
								{#each providers as provider (provider.providerId)}
									<DropdownMenu.Item onclick={() => onProviderSelect?.(provider.providerId)}>
										{provider.providerId.charAt(0).toUpperCase() + provider.providerId.slice(1)}
									</DropdownMenu.Item>
								{/each}
							{:else}
								<DropdownMenu.Item disabled>No providers available</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					{#if movie?.trailerUrl}
						<Button
							variant="secondary"
							size="lg"
							class="h-12 gap-2 px-6"
							onclick={() => window.open(movie.trailerUrl!, '_blank', 'noopener,noreferrer')}
						>
							<Film class="size-5" />
							Trailer
						</Button>
					{/if}

					<Button
						variant="outline"
						size="lg"
						class="h-12 gap-2 px-6"
						onclick={handleWatchlistToggle}
					>
						{#if isInWatchlist}
							<BookmarkMinus class="size-5" />
						{:else}
							<Bookmark class="size-5" />
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>
</div>
