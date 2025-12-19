<script lang="ts">
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource } from '$lib/streaming';
	import { Button } from '$lib/components/ui/button';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { MovieScrollContainer } from '$lib/components';
	import type { LibraryMovie } from '$lib/types/library';

	type MediaType = 'movie' | 'tv';

	type MediaGenre = { id: number; name: string };
	type MediaCastMember = { id: number; name: string; character: string };

	type MediaDetails = {
		id: string;
		tmdbId: number | null;
		title: string;
		overview: string | null;
		posterPath: string | null;
		backdropPath: string | null;
		releaseDate: string | null;
		rating: number | null;
		durationMinutes: number | null;
		genres?: MediaGenre[];
		cast?: MediaCastMember[];
		trailerUrl?: string | null;
		imdbId?: string | null;
		media_type?: string | null;
		is4K?: boolean;
		isHD?: boolean | null;
		collectionId?: number | null;
		seasonCount?: number | null;
		episodeCount?: number | null;
		seasons?: {
			id: number;
			name: string;
			seasonNumber: number;
			episodeCount: number;
			posterPath: string | null;
		}[];
	};

	type Episode = {
		id: number;
		name: string;
		episodeNumber: number;
		seasonNumber: number;
		stillPath: string | null;
	};

	type StreamingPayloadLike = {
		source: StreamingSource | null;
		resolutions: ProviderResolution[] | ReadonlyArray<ProviderResolution>;
	};

	let {
		data
	}: {
		data: {
			movie: MediaDetails | null;
			streaming?: StreamingPayloadLike;
			mediaType?: MediaType;
			recommendations?: LibraryMovie[];
		} & Record<string, unknown>;
	} = $props();

	const movie = $derived(data.movie ?? null);
	const mediaType = $derived((data.mediaType ?? 'movie') as MediaType);

	const initialStreaming: StreamingState = data.streaming
		? {
				source: data.streaming.source ?? null,
				resolutions: [...data.streaming.resolutions]
			}
		: { source: null, resolutions: [] };
	type StreamingState = {
		source: StreamingSource | null;
		resolutions: ProviderResolution[];
	};

	let selectedProvider = $state<string | null>(null);
	let isResolving = $state(false);
	let hasRequestedPlayback = $state(Boolean(initialStreaming.source));
	let resolveError = $state<string | null>(null);

	let currentStreaming = $state<StreamingState>(initialStreaming);

	let selectedSeason = $state<number>(1);
	let selectedEpisode = $state<number>(1);
	let episodesList = $state<Episode[]>([]);
	let isLoadingEpisodes = $state(false);

	let providerResolutions = $derived(currentStreaming.resolutions);
	let primarySource = $derived(currentStreaming.source);
	let playbackUrl = $derived(primarySource?.embedUrl ?? primarySource?.streamUrl ?? null);
	let displayPlayer = $derived(hasRequestedPlayback && Boolean(playbackUrl));
	let primaryLabel = $derived(
		primarySource
			? (providerResolutions.find(
					(r: ProviderResolution) => r.providerId === primarySource.providerId
				)?.label ?? primarySource.providerId)
			: null
	);

	const parseReleaseYear = (value: string | null) => {
		if (!value) return 'N/A';
		const date = new Date(value);
		const year = date.getFullYear();
		return Number.isFinite(year) ? year : 'N/A';
	};

	let releaseYear = $derived(parseReleaseYear(movie?.releaseDate ?? null));
	let runtimeLabel = $derived(() => {
		if (!movie?.durationMinutes) {
			return mediaType === 'tv' ? 'Runtime varies' : 'N/A';
		}
		return `${movie.durationMinutes} min`;
	});

	$effect(() => {
		if (typeof window !== 'undefined' && movie?.id) {
			const normalizedGenres =
				movie.genres?.map((genre) => ('name' in genre ? String(genre.name) : String(genre))) ?? [];

			const watchPayload: any = {
				id: movie.id,
				title: movie.title,
				posterPath: movie.posterPath ?? null,
				backdropPath: movie.backdropPath ?? null,
				overview: movie.overview ?? null,
				releaseDate: movie.releaseDate ? new Date(movie.releaseDate).toISOString() : null,
				rating: movie.rating ?? 0,
				genres: normalizedGenres,
				trailerUrl: movie.trailerUrl ?? null,
				media_type: mediaType,
				is4K: Boolean(movie.is4K),
				isHD: movie.isHD ?? undefined,
				tmdbId: movie.tmdbId ?? undefined,
				imdbId: movie.imdbId ?? undefined,
				durationMinutes: movie.durationMinutes ?? null,
				collectionId: movie.collectionId ?? null
			};

			if (mediaType === 'tv') {
				watchPayload.season = selectedSeason;
				watchPayload.episode = selectedEpisode;
			}

			watchHistory.recordWatch(watchPayload);
		}
	});

	$effect(() => {
		if (mediaType === 'tv' && movie?.tmdbId) {
			fetchEpisodes(selectedSeason);
		}
	});

	async function fetchEpisodes(seasonNumber: number) {
		if (!movie?.tmdbId) return;
		isLoadingEpisodes = true;
		try {
			const response = await fetch(`/api/tv/${movie.tmdbId}/season/${seasonNumber}`);
			if (response.ok) {
				const data = await response.json();
				episodesList = data.episodes || [];
			}
		} catch (error) {
			console.error('Failed to fetch episodes', error);
		} finally {
			isLoadingEpisodes = false;
		}
	}

	$effect(() => {
		if (!selectedProvider && providerResolutions.length > 0) {
			selectedProvider =
				primarySource?.providerId ??
				providerResolutions.find((r: ProviderResolution) => r.success)?.providerId ??
				providerResolutions[0]?.providerId ??
				null;
		}
	});

	$effect(() => {
		if (
			selectedProvider &&
			providerResolutions.length > 0 &&
			!providerResolutions.some((r: ProviderResolution) => r.providerId === selectedProvider)
		) {
			selectedProvider =
				providerResolutions.find((r: ProviderResolution) => r.success)?.providerId ??
				providerResolutions[0]?.providerId ??
				null;
		}
	});

	$effect(() => {
		if (currentStreaming.source && !hasRequestedPlayback) {
			hasRequestedPlayback = true;
		}
	});

	async function requestProviderResolution(providerId: string) {
		if (!movie?.tmdbId) return;

		isResolving = true;
		resolveError = null;

		try {
			const response = await fetch('/api/streaming', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mediaType,
					tmdbId: Number(movie.tmdbId),
					imdbId: movie.imdbId ?? undefined,
					season: mediaType === 'tv' ? selectedSeason : undefined,
					episode: mediaType === 'tv' ? selectedEpisode : undefined,
					preferredProviders: providerId ? [providerId] : undefined
				})
			});

			if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

			const payload = await response.json();

			currentStreaming = {
				source: payload?.source ?? null,
				resolutions: Array.isArray(payload?.resolutions) ? [...payload.resolutions] : []
			};

			const resolvedProviderId = currentStreaming.source?.providerId ?? null;
			if (resolvedProviderId && resolvedProviderId !== selectedProvider) {
				selectedProvider = resolvedProviderId;
			}

			if (!currentStreaming.source) {
				resolveError = 'Provider did not return a playable stream. Please try another option.';
			} else {
				hasRequestedPlayback = true;
			}
		} catch (error) {
			console.error('[media][resolveProvider]', error);
			resolveError = error instanceof Error ? error.message : 'Failed to load provider stream.';
		} finally {
			isResolving = false;
		}
	}

	function handleProviderSelectionChange(providerId: string) {
		resolveError = null;
		if (selectedProvider === providerId) {
			return;
		}

		selectedProvider = providerId;
	}

	async function handlePlayClick() {
		if (!selectedProvider) {
			resolveError = 'Select a provider before playing.';
			return;
		}

		const alreadyResolved = primarySource?.providerId === selectedProvider && Boolean(playbackUrl);

		if (alreadyResolved) {
			hasRequestedPlayback = true;
			return;
		}

		await requestProviderResolution(selectedProvider);
	}

	function handleOpenInNewTab() {
		if (!playbackUrl) return;
		window.open(playbackUrl, '_blank', 'noopener,noreferrer');
	}

	function handleEpisodeSelect(episodeNum: number) {
		selectedEpisode = episodeNum;
		hasRequestedPlayback = false;
		currentStreaming = { source: null, resolutions: [] };
		if (selectedProvider) {
			requestProviderResolution(selectedProvider);
		}
	}

	function handleSeasonChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		selectedSeason = Number(target.value);
		selectedEpisode = 1;
		hasRequestedPlayback = false;
		currentStreaming = { source: null, resolutions: [] };
	}

	const notFoundHeading = $derived(mediaType === 'tv' ? 'Series Not Found' : 'Movie Not Found');
	const notFoundDescription = $derived(
		mediaType === 'tv'
			? 'The TV show you are looking for does not exist.'
			: 'The movie you are looking for does not exist.'
	);
</script>

{#if !movie}
	<div class="flex min-h-screen flex-col items-center justify-center text-foreground">
		<h1 class="text-4xl font-bold">{notFoundHeading}</h1>
		<p class="text-lg">{notFoundDescription}</p>
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<main class="container mx-auto p-4">
			<div class="relative mb-8 h-96 w-full">
				{#if movie.backdropPath}
					<img
						src={movie.backdropPath}
						alt={movie.title}
						class="h-full w-full rounded-lg object-cover"
					/>
				{/if}
				<div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent"></div>
				<div class="absolute bottom-4 left-4">
					<h1 class="text-5xl font-bold text-foreground">{movie.title}</h1>
					<p class="text-xl text-gray-300">
						{releaseYear} | {runtimeLabel}
					</p>
				</div>
			</div>

			{#if displayPlayer}
				<div class="mb-8 aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl">
					{#if primarySource?.embedUrl}
						<iframe
							src={playbackUrl!}
							title="Player"
							class="h-full w-full"
							frameborder="0"
							allowfullscreen
						></iframe>
					{:else}
						<div class="flex h-full items-center justify-center text-white">
							<p>Stream not available for this provider.</p>
						</div>
					{/if}
				</div>
			{/if}

			{#if providerResolutions.length}
				<section class="mb-6">
					<h3 class="mb-3 text-xl font-semibold">Choose Provider</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Pick a streaming API and then press play to load the player.
					</p>

					<div class="flex flex-wrap gap-2">
						{#each providerResolutions as resolution}
							<Button
								variant={selectedProvider === resolution.providerId ? 'default' : 'outline'}
								class="rounded-full"
								onclick={() => handleProviderSelectionChange(resolution.providerId)}
							>
								{resolution.label}
							</Button>
						{/each}
					</div>

					{#if resolveError}
						<p class="mt-2 text-sm text-destructive">{resolveError}</p>
					{/if}

					<div class="mt-4 flex items-center gap-3">
						<Button onclick={handlePlayClick} disabled={isResolving}>
							{isResolving ? 'Loading…' : hasRequestedPlayback ? 'Reload Player' : 'Play'}
						</Button>

						{#if playbackUrl}
							<Button variant="secondary" onclick={handleOpenInNewTab}>Open in New Tab</Button>
						{/if}
					</div>
				</section>
			{/if}

			{#if mediaType === 'tv' && movie.seasons}
				<section class="mb-8">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-xl font-semibold">Episodes</h3>
						<select
							class="rounded-md border border-border bg-background px-3 py-1 text-sm"
							onchange={handleSeasonChange}
							value={selectedSeason}
						>
							{#each movie.seasons as season}
								<option value={season.seasonNumber}>
									{season.name} ({season.episodeCount} Episodes)
								</option>
							{/each}
						</select>
					</div>

					{#if isLoadingEpisodes}
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each Array(5) as _}
								<div class="aspect-video animate-pulse rounded-md bg-muted"></div>
							{/each}
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each episodesList as episode}
								<button
									class="group relative aspect-video overflow-hidden rounded-md border transition-all hover:border-primary {selectedEpisode ===
									episode.episodeNumber
										? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
										: 'border-border'}"
									onclick={() => handleEpisodeSelect(episode.episodeNumber)}
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
			{/if}

			<section class="grid gap-6 lg:grid-cols-[300px,1fr]">
				<div class="space-y-4">
					{#if movie.posterPath}
						<img src={movie.posterPath} alt={movie.title} class="w-full rounded-lg object-cover" />
					{/if}

					<div class="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
						<h2 class="text-xl font-semibold">Overview</h2>
						<p class="text-sm text-muted-foreground">
							{movie.overview ?? 'No overview available.'}
						</p>
					</div>

					{#if movie.genres?.length}
						<div class="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
							<h2 class="text-xl font-semibold">Genres</h2>
							<div class="flex flex-wrap gap-2">
								{#each movie.genres as genre}
									<span class="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
										{genre.name}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if movie.trailerUrl}
						<div class="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
							<h2 class="text-xl font-semibold">Trailer</h2>
							<div class="aspect-video overflow-hidden rounded-lg">
								<iframe
									src={movie.trailerUrl}
									title="Trailer"
									frameborder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
									loading="lazy"
									referrerpolicy="strict-origin-when-cross-origin"
									class="h-full w-full"
								></iframe>
							</div>
						</div>
					{/if}
				</div>

				<div class="space-y-6">
					<div class="rounded-lg border border-border/50 bg-muted/20 p-6">
						<h2 class="mb-4 text-2xl font-semibold">
							About this {mediaType === 'tv' ? 'Series' : 'Movie'}
						</h2>
						<ul class="space-y-2 text-sm text-muted-foreground">
							<li>
								<span class="font-semibold text-foreground">TMDB Rating:</span>
								{movie.rating ? movie.rating.toFixed(1) : 'N/A'}
							</li>
							<li>
								<span class="font-semibold text-foreground">Release:</span>
								{movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'TBA'}
							</li>
							{#if mediaType === 'tv'}
								<li>
									<span class="font-semibold text-foreground">Seasons:</span>
									{movie.seasonCount ?? 'N/A'}
								</li>
								<li>
									<span class="font-semibold text-foreground">Episodes:</span>
									{movie.episodeCount ?? 'N/A'}
								</li>
							{/if}
							{#if movie.imdbId}
								<li>
									<span class="font-semibold text-foreground">IMDb:</span>
									<a
										href={`https://www.imdb.com/title/${movie.imdbId}/`}
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary underline"
									>
										{movie.imdbId}
									</a>
								</li>
							{/if}
						</ul>
					</div>

					{#if movie.cast?.length}
						<div class="rounded-lg border border-border/50 bg-muted/20 p-6">
							<h2 class="mb-4 text-2xl font-semibold">Cast</h2>
							<ul class="grid gap-3 md:grid-cols-2">
								{#each movie.cast as member}
									<li class="rounded-md border border-border/40 bg-background/80 px-3 py-2">
										<p class="font-semibold text-foreground">{member.name}</p>
										<p class="text-xs text-muted-foreground">{member.character}</p>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</section>

			{#if data.recommendations && data.recommendations.length > 0}
				<section class="mt-12 mb-8">
					<MovieScrollContainer title="More Like This" movies={data.recommendations} />
				</section>
			{/if}
		</main>
	</div>
{/if}
