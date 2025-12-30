<script lang="ts">
	import { page } from '$app/stores';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource } from '$lib/streaming';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { MovieScrollContainer } from '$lib/components';
	import type { LibraryMovie } from '$lib/types/library';
	import { StructuredData, SEOHead } from '$lib/components/seo';
	import { StreamingService, type MediaType } from '$lib/streaming/streamingService.svelte';
	import { PlayerService } from '$lib/components/player/playerService.svelte';
	import { EpisodeService } from '$lib/components/episodes/episodeService.svelte';
	import MediaHeader from '$lib/components/media/MediaHeader.svelte';
	import EpisodeGrid from '$lib/components/episodes/EpisodeGrid.svelte';
	import MediaOverview from '$lib/components/media/MediaOverview.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { playbackStore } from '$lib/state/stores/playbackStore.svelte';

	type MediaGenre = { id: number; name: string };
	type MediaCastMember = {
		id: number;
		name: string;
		character: string;
		profilePath?: string | null;
	};

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
		episodeRuntimes?: number[];
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
		productionCompanies?: { id: number; name: string; logoPath: string | null }[];
		productionCountries?: { iso: string; name: string }[];
		voteCount?: number | null;
		logoPath?: string | null;
	};

	type StreamingPayloadLike = {
		source: StreamingSource | null;
		resolutions: ProviderResolution[] | ReadonlyArray<ProviderResolution>;
	};

	const props = $props<{
		data: {
			movie: MediaDetails | null;
			streaming?: StreamingPayloadLike;
			mediaType?: MediaType;
			recommendations?: LibraryMovie[];
			csrfToken?: string;
			canonicalPath?: string;
		} & Record<string, unknown>;
	}>();

	const movie = $derived(props.data.movie ?? null);
	const mediaType = $derived((props.data.mediaType ?? 'movie') as MediaType);
	const canonicalPath = $derived(props.data.canonicalPath as string | undefined);
	const data = $derived(props.data);

	const streamingService = new StreamingService();
	const playerService = new PlayerService();
	const episodeService = new EpisodeService();

	let subOrDub = $state<'sub' | 'dub'>('sub');
	let activeTab = $state<'suggested' | 'details'>('suggested');

	$effect(() => {
		if (movie) {
			streamingService.setCurrentMedia({
				mediaId: movie.id,
				tmdbId: movie.tmdbId,
				mediaType: mediaType,
				season:
					mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedSeason : undefined,
				episode:
					mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedEpisode : undefined
			});

			if (data.streaming) {
				streamingService.initializeFromServerData({
					source: data.streaming.source ?? null,
					resolutions: Array.isArray(data.streaming.resolutions)
						? [...data.streaming.resolutions]
						: []
				});
			} else {
				console.log('[DEBUG] MediaDetailsPage: No streaming data available');
			}
		}
	});

	async function handlePlayClick() {
		if (!streamingService.currentProviderId) {
			streamingService.state.error = 'Select a provider before playing.';
			return;
		}

		const alreadyResolved =
			streamingService.state.source?.providerId === streamingService.currentProviderId &&
			Boolean(streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl);

		if (alreadyResolved) {
			return;
		}

		const savedProgress = playbackStore.getProgress(
			movie?.id ?? '',
			mediaType,
			mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedSeason : undefined,
			mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedEpisode : undefined
		);

		await streamingService.resolveProvider(streamingService.currentProviderId, {
			tmdbId: Number(movie?.tmdbId),
			mediaType: mediaType,
			imdbId: movie?.imdbId ?? undefined,
			malId: (movie as { malId?: number })?.malId ?? undefined,
			subOrDub: mediaType === 'anime' ? subOrDub : undefined,
			season:
				mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedSeason : undefined,
			episode:
				mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedEpisode : undefined,
			preferredQuality: playerService.selectedQuality,
			preferredSubtitleLanguage: playerService.selectedSubtitle,
			csrfToken: data.csrfToken,
			startAt: savedProgress?.progress ? Math.floor(savedProgress.progress) : undefined
		});
	}

	function handleEpisodeSelect(episodeNum: number) {
		episodeService.handleEpisodeSelect(episodeNum);

		streamingService.reset();
		playerService.cleanup();

		if (streamingService.currentProviderId) {
			handlePlayClick();
		}
	}

	function handleSeasonChange(value: string) {
		episodeService.handleSeasonChange(Number(value));

		streamingService.reset();
		playerService.cleanup();
		streamingService.state.qualities = [];
		streamingService.state.subtitles = [];

		if (movie?.tmdbId && (mediaType === 'tv' || mediaType === 'anime')) {
			episodeService.fetchEpisodes(movie.tmdbId, episodeService.selectedSeason);
		}
	}

	function goToNextEpisode() {
		if (!movie?.seasons || (mediaType !== 'tv' && mediaType !== 'anime')) return;

		const currentSeasonData = movie.seasons.find(
			(s: { seasonNumber: number; episodeCount: number }) =>
				s.seasonNumber === episodeService.selectedSeason
		);
		if (!currentSeasonData) return;

		if (episodeService.selectedEpisode < currentSeasonData.episodeCount) {
			handleEpisodeSelect(episodeService.selectedEpisode + 1);
		} else {
			const nextSeason = movie.seasons.find(
				(s: { seasonNumber: number }) => s.seasonNumber === episodeService.selectedSeason + 1
			);
			if (nextSeason) {
				episodeService.handleSeasonChange(nextSeason.seasonNumber);
				handleEpisodeSelect(1);
			}
		}
	}

	function handleOpenInNewTab() {
		const playbackUrl =
			streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl ?? null;
		if (!playbackUrl) return;
		window.open(playbackUrl, '_blank', 'noopener,noreferrer');
	}

	async function handleHeaderPlay(providerId: string) {
		streamingService.selectProvider(providerId);

		const win = window.open('about:blank', '_blank', 'noopener,noreferrer');

		try {
			await handlePlayClick();
			const playbackUrl =
				streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl ?? null;

			if (win && playbackUrl) {
				win.location.href = playbackUrl;
			} else if (win) {
				win.close();
			}
		} catch (e) {
			console.error('Play failed', e);
			win?.close();
		}
	}

	$effect(() => {
		if (!streamingService.currentProviderId && streamingService.state.resolutions.length > 0) {
			streamingService.selectProvider(
				streamingService.state.source?.providerId ??
					streamingService.state.resolutions.find((r: ProviderResolution) => r.success)
						?.providerId ??
					streamingService.state.resolutions[0]?.providerId ??
					null
			);
		}
	});

	$effect(() => {
		if (
			streamingService.currentProviderId &&
			streamingService.state.resolutions.length > 0 &&
			!streamingService.state.resolutions.some(
				(r: ProviderResolution) => r.providerId === streamingService.currentProviderId
			)
		) {
			streamingService.selectProvider(
				streamingService.state.resolutions.find((r: ProviderResolution) => r.success)?.providerId ??
					streamingService.state.resolutions[0]?.providerId ??
					null
			);
		}
	});

	$effect(() => {
		if (streamingService.state.source) {
			handlePlayClick();
		}
	});

	$effect(() => {
		const displayPlayer = Boolean(
			streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl
		);
		if (displayPlayer && movie) {
			playerService.startProgressTracking(
				movie.id,
				mediaType,
				movie.durationMinutes,
				mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedSeason : null,
				mediaType === 'tv' || mediaType === 'anime' ? episodeService.selectedEpisode : null,
				async (progress) => {
					if (!movie) return;

					playbackStore.saveProgress({
						mediaId: movie.id,
						mediaType,
						progress,
						duration: movie.durationMinutes ? movie.durationMinutes * 60 : 0,
						seasonNumber:
							mediaType === 'tv' || mediaType === 'anime'
								? episodeService.selectedSeason
								: undefined,
						episodeNumber:
							mediaType === 'tv' || mediaType === 'anime'
								? episodeService.selectedEpisode
								: undefined,
						updatedAt: Date.now(),
						movieData: {
							...movie,
							mediaType
						} as LibraryMovie
					});

					try {
						const duration = movie.durationMinutes ? movie.durationMinutes * 60 : 0;
						if (duration > 0 && $page.data.user) {
							const headers: Record<string, string> = { 'Content-Type': 'application/json' };
							if (data.csrfToken) {
								headers['X-CSRF-Token'] = data.csrfToken;
							}

							const response = await fetch('/api/playback/progress', {
								method: 'POST',
								headers,
								body: JSON.stringify({
									mediaId: movie.id,
									mediaType,
									progress: progress,
									duration,
									seasonNumber:
										mediaType === 'tv' || mediaType === 'anime'
											? episodeService.selectedSeason
											: undefined,
									episodeNumber:
										mediaType === 'tv' || mediaType === 'anime'
											? episodeService.selectedEpisode
											: undefined
								}),
								credentials: 'include'
							});

							if (!response.ok) {
								if (response.status === 401 || response.status === 403) {
									return;
								}
								console.error(
									`Failed to save playback progress: ${response.status} ${response.statusText}`
								);
							}
						}
					} catch (error) {
						console.error('Failed to save playback progress:', error);
					}
				}
			);
		} else {
			playerService.stopProgressTracking();
		}
	});

	$effect(() => {
		const displayPlayer = Boolean(
			streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl
		);
		if (displayPlayer && movie?.durationMinutes && (mediaType === 'tv' || mediaType === 'anime')) {
			playerService.setupAutoPlayTimer(movie.durationMinutes, goToNextEpisode);
		} else {
			playerService.cancelAutoPlay();
		}
	});

	$effect(() => {
		function handleMessage(event: MessageEvent) {
			if (!event.origin.includes(window.location.hostname) && event.origin !== 'null') {
				return;
			}

			const data = event.data;
			if (data && typeof data === 'object') {
				if (data.type === 'progressUpdate' && typeof data.progress === 'number') {
					playerService.currentProgress = data.progress;
				}
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('message', handleMessage);
			return () => {
				window.removeEventListener('message', handleMessage);
			};
		}
	});

	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement
			) {
				return;
			}

			const displayPlayer = Boolean(
				streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl
			);

			switch (event.key.toLowerCase()) {
				case 'n':
					if (displayPlayer && (mediaType === 'tv' || mediaType === 'anime')) {
						event.preventDefault();
						goToNextEpisode();
					}
					break;
				case 'p':
					if (
						displayPlayer &&
						(mediaType === 'tv' || mediaType === 'anime') &&
						episodeService.selectedEpisode > 1
					) {
						event.preventDefault();
						handleEpisodeSelect(episodeService.selectedEpisode - 1);
					}
					break;
				case 'arrowright':
				case 'arrowleft':
					if (displayPlayer) {
						event.preventDefault();
					}
					break;
				case '+':
				case '=':
					if (displayPlayer) {
						event.preventDefault();
						playerService.handlePlaybackSpeedChange(playerService.playbackSpeed + 0.25);
					}
					break;
				case '-':
					if (displayPlayer) {
						event.preventDefault();
						playerService.handlePlaybackSpeedChange(playerService.playbackSpeed - 0.25);
					}
					break;
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		if (typeof window !== 'undefined' && movie?.id) {
			const normalizedGenres =
				movie.genres?.map((genre: MediaGenre) =>
					'name' in genre ? String(genre.name) : String(genre)
				) ?? [];

			type WatchPayload = {
				id: string;
				title: string;
				posterPath: string | null;
				backdropPath: string | null;
				overview: string | null;
				releaseDate: string | null;
				rating: number;
				genres: string[];
				trailerUrl: string | null;
				media_type: MediaType;
				is4K: boolean;
				isHD: boolean | undefined;
				tmdbId: number | undefined;
				imdbId: string | undefined;
				durationMinutes: number | null;
				collectionId: number | null;
				season?: number;
				episode?: number;
			};

			const watchPayload: WatchPayload = {
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

			if (mediaType === 'tv' || mediaType === 'anime') {
				watchPayload.season = episodeService.selectedSeason;
				watchPayload.episode = episodeService.selectedEpisode;
			}

			watchHistory.recordWatch(watchPayload);
		}
	});

	$effect(() => {
		if ((mediaType === 'tv' || mediaType === 'anime') && movie?.tmdbId) {
			episodeService.fetchEpisodes(movie.tmdbId, episodeService.selectedSeason);
		}
	});

	const ogImage = $derived(
		movie?.backdropPath
			? movie.backdropPath.startsWith('http')
				? movie.backdropPath
				: `https://image.tmdb.org/t/p/w1280${movie.backdropPath}`
			: movie?.posterPath
				? movie.posterPath.startsWith('http')
					? movie.posterPath
					: `https://image.tmdb.org/t/p/w780${movie.posterPath}`
				: null
	);

	const notFoundHeading = $derived(
		mediaType === 'tv' || mediaType === 'anime' ? 'Series Not Found' : 'Movie Not Found'
	);
	const notFoundDescription = $derived(
		mediaType === 'tv' || mediaType === 'anime'
			? 'The show you are looking for does not exist.'
			: 'The movie you are looking for does not exist.'
	);

	const availableProviders = $derived(
		streamingService.state.resolutions.length > 0
			? streamingService.state.resolutions
			: data.streaming?.resolutions || []
	);
</script>

{#if movie}
	<SEOHead
		title={movie.title}
		description={movie.overview ||
			`Watch ${movie.title} on MeatFlicks - Free streaming of movies and TV shows`}
		canonical={canonicalPath ?? undefined}
		ogType={mediaType === 'tv' || mediaType === 'anime' ? 'video.tv_show' : 'video.movie'}
		ogImage={ogImage ?? undefined}
		ogImageAlt={`${movie.title} poster`}
		twitterCard="summary_large_image"
		keywords={[
			movie.title,
			...(movie.genres?.map((g: MediaGenre) => g.name) || []),
			mediaType === 'tv' || mediaType === 'anime' ? 'TV show' : 'movie',
			'watch online',
			'free streaming'
		]}
		publishedTime={movie.releaseDate || undefined}
	/>
	<StructuredData media={movie} {mediaType} canonicalUrl={canonicalPath} />
{:else}
	<SEOHead title={notFoundHeading} description={notFoundDescription} noindex={true} />
{/if}

{#if !movie}
	<div class="flex min-h-screen flex-col items-center justify-center text-foreground">
		<h1 class="text-4xl font-bold">{notFoundHeading}</h1>
		<p class="text-lg">{notFoundDescription}</p>
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<main class="mx-auto">
			<MediaHeader
				{movie}
				logoPath={movie.logoPath}
				providers={availableProviders}
				onProviderSelect={handleHeaderPlay}
			/>

			{#if mediaType === 'anime'}
				<div class="mb-6 flex items-center justify-center gap-4">
					<span class="text-sm font-medium tracking-wider text-muted-foreground uppercase"
						>Type:</span
					>
					<div class="flex rounded-md bg-muted p-1">
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'sub'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => {
								subOrDub = 'sub';
							}}
						>
							Sub
						</button>
						<button
							class="rounded px-4 py-1.5 text-sm font-medium transition-all {subOrDub === 'dub'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => {
								subOrDub = 'dub';
							}}
						>
							Dub
						</button>
					</div>
				</div>
			{/if}

			<div class="mt-8 w-full">
				<div class="px-[10%]">
					<div class="mb-2 flex gap-2">
						<button
							class="px-3 py-1 text-sm font-medium transition-colors {activeTab === 'suggested'
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => (activeTab = 'suggested')}
						>
							Suggested
						</button>
						<button
							class="px-3 py-1 text-sm font-medium transition-colors {activeTab === 'details'
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => (activeTab = 'details')}
						>
							Details
						</button>
					</div>
					<Separator class="mb-2" />
				</div>

				{#if activeTab === 'suggested'}
					<div>
						{#if data.recommendations && data.recommendations.length > 0}
							<MovieScrollContainer title="" movies={data.recommendations} />
						{:else}
							<div class="py-12 text-center text-muted-foreground">
								No recommendations available.
							</div>
						{/if}
					</div>
				{:else if activeTab === 'details'}
					<div>
						{#if (mediaType === 'tv' || mediaType === 'anime') && movie.seasons}
							<div class="mb-10">
								<h3 class="mb-4 text-2xl font-bold">Episodes</h3>
								<EpisodeGrid
									episodes={episodeService.episodesList}
									selectedEpisode={episodeService.selectedEpisode}
									selectedSeason={episodeService.selectedSeason}
									seasons={movie.seasons}
									isLoading={episodeService.isLoadingEpisodes}
									onSeasonChange={handleSeasonChange}
									onEpisodeSelect={handleEpisodeSelect}
								/>
							</div>
						{/if}

						<section class="grid gap-6 lg:grid-cols-[70%,30%]">
							<div class="space-y-4">
								<MediaOverview
									cast={movie.cast}
									productionCompanies={movie.productionCompanies}
									posterPath={movie.posterPath}
									title={movie.title}
									overview={movie.overview ?? null}
								/>
							</div>
						</section>
					</div>
				{/if}
			</div>
		</main>
	</div>
{/if}
