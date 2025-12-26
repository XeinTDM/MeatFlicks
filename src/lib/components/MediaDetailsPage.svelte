<script lang="ts">
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource, VideoQuality, SubtitleTrack } from '$lib/streaming';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Card } from '$lib/components/ui/card';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { MovieScrollContainer } from '$lib/components';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import PlayerControls from '$lib/components/player/PlayerControls.svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import { StructuredData, Breadcrumbs, SEOHead } from '$lib/components/seo';
	import { PictureInPicture, RefreshCw, MonitorPlay, Star, Film } from '@lucide/svelte';

	type MediaType = 'movie' | 'tv';

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
			csrfToken?: string;
		} & Record<string, unknown>;
	} = $props();

	const movie = $derived(data.movie ?? null);
	const mediaType = $derived((data.mediaType ?? 'movie') as MediaType);
	const canonicalPath = $derived(data.canonicalPath as string | undefined);

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

	let isTheaterMode = $state(false);
	let isAutoPlay = $state(true);
	let showNextOverlay = $state(false);
	let nextEpTimer: ReturnType<typeof setTimeout> | null = null;
	let autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
	let playbackSpeed = $state(1.0);
	let iframeElement = $state<HTMLIFrameElement | null>(null);
	let selectedQuality = $state<string>('auto');
	let selectedSubtitle = $state<string | null>(null);
	let currentQualities = $state<VideoQuality[]>([]);
	let currentSubtitles = $state<SubtitleTrack[]>([]);
	let progressSaveInterval: ReturnType<typeof setInterval> | null = null;
	let currentProgress = $state(0);

	function stopProgressTracking() {
		if (progressSaveInterval) {
			clearInterval(progressSaveInterval);
			progressSaveInterval = null;
		}
	}

	$effect(() => {
		const currentDisplayPlayer = displayPlayer;
		const currentMovie = movie;

		if (currentDisplayPlayer && currentMovie) {
			stopProgressTracking();

			if (progressSaveInterval) {
				clearInterval(progressSaveInterval);
			}

			progressSaveInterval = setInterval(async () => {
				if (!movie || !displayPlayer) return;

				try {
					const duration = movie.durationMinutes ? movie.durationMinutes * 60 : 0;
					if (duration > 0) {
						await fetch('/api/playback/progress', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								mediaId: movie.id,
								mediaType,
								progress: currentProgress,
								duration,
								seasonNumber: mediaType === 'tv' ? selectedSeason : undefined,
								episodeNumber: mediaType === 'tv' ? selectedEpisode : undefined
							}),
							credentials: 'include'
						});
					}
				} catch (error) {
					console.error('Failed to save playback progress:', error);
				}
			}, 30000);
		} else {
			stopProgressTracking();
		}

		return () => {
			stopProgressTracking();
		};
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

			const currentDisplayPlayer = displayPlayer;
			const currentIsTheaterMode = isTheaterMode;
			const currentMediaType = mediaType;
			const currentSelectedEpisode = selectedEpisode;

			switch (event.key.toLowerCase()) {
				case 'f':
					if (currentDisplayPlayer) {
						event.preventDefault();
						toggleTheaterMode();
					}
					break;
				case 'escape':
					if (currentIsTheaterMode) {
						event.preventDefault();
						isTheaterMode = false;
					}
					break;
				case 'n':
					if (currentDisplayPlayer && currentMediaType === 'tv') {
						event.preventDefault();
						goToNextEpisode();
					}
					break;
				case 'p':
					if (currentDisplayPlayer && currentMediaType === 'tv' && currentSelectedEpisode > 1) {
						event.preventDefault();
						handleEpisodeSelect(currentSelectedEpisode - 1);
					}
					break;
				case 'arrowright':
					if (currentDisplayPlayer) {
						event.preventDefault();
					}
					break;
				case 'arrowleft':
					if (currentDisplayPlayer) {
						event.preventDefault();
					}
					break;
				case '+':
				case '=':
					if (currentDisplayPlayer) {
						event.preventDefault();
						playbackSpeed = Math.min(2.0, playbackSpeed + 0.25);
					}
					break;
				case '-':
					if (currentDisplayPlayer) {
						event.preventDefault();
						playbackSpeed = Math.max(0.25, playbackSpeed - 0.25);
					}
					break;
				case 'i':
					if (
						currentDisplayPlayer &&
						typeof document !== 'undefined' &&
						'pictureInPictureEnabled' in document
					) {
						event.preventDefault();
						togglePictureInPicture();
					}
					break;
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

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

	let nextEpisodeLabel = $derived.by(() => {
		if (!movie?.seasons || mediaType !== 'tv') return 'Next Episode';
		const currentSeasonData = movie.seasons.find((s) => s.seasonNumber === selectedSeason);
		if (!currentSeasonData) return 'Next Episode';

		if (selectedEpisode < currentSeasonData.episodeCount) {
			return `S${selectedSeason}:E${selectedEpisode + 1}`;
		} else {
			const nextSeason = movie.seasons.find((s) => s.seasonNumber === selectedSeason + 1);
			if (nextSeason) {
				return `S${nextSeason.seasonNumber}:E1`;
			}
		}
		return 'Next Episode';
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
			const response = await fetch(`/api/tv/${movie.tmdbId}/season/${seasonNumber}`, {
				credentials: 'include'
			});
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

	$effect(() => {
		if (iframeElement && iframeElement.contentWindow && displayPlayer) {
			iframeElement.contentWindow.postMessage(
				{
					type: 'playbackSpeedChange',
					speed: playbackSpeed
				},
				'*'
			);
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
					currentProgress = data.progress;
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
					preferredQuality: selectedQuality,
					preferredSubtitleLanguage: selectedSubtitle,
					includeQualities: true,
					includeSubtitles: true,
					preferredProviders: providerId ? [providerId] : undefined,
					csrf_token: data.csrfToken
				}),
				credentials: 'include'
			});

			if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

			const payload = await response.json();

			if (payload.source) {
				currentQualities = payload.source.qualities || [];
				currentSubtitles = payload.source.subtitles || [];
			}

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

	function handleSeasonChange(value: string) {
		selectedSeason = Number(value);
		selectedEpisode = 1;
		hasRequestedPlayback = false;
		currentStreaming = { source: null, resolutions: [] };
		currentQualities = [];
		currentSubtitles = [];
	}

	function handleQualityChange(quality: VideoQuality) {
		selectedQuality = quality.label;
		if (primarySource && currentQualities.some((q) => q.url === quality.url)) {
			playbackUrl = quality.url;
			if (iframeElement && iframeElement.contentWindow) {
				iframeElement.contentWindow.postMessage(
					{
						type: 'qualityChange',
						quality: quality.url
					},
					'*'
				);
			}
		}
	}

	function handleSubtitleChange(subtitle: SubtitleTrack | null) {
		selectedSubtitle = subtitle?.id || null;
		if (iframeElement && iframeElement.contentWindow) {
			iframeElement.contentWindow.postMessage(
				{
					type: 'subtitleChange',
					subtitle: subtitle
						? {
								url: subtitle.url,
								language: subtitle.language,
								label: subtitle.label
							}
						: null
				},
				'*'
			);
		}
	}

	function handleIframeLoad() {
		if (iframeElement?.contentWindow) {
			let qualityValue = 'auto';
			if (selectedQuality !== 'auto') {
				const quality = currentQualities.find((q) => q.label === selectedQuality);
				if (quality) {
					qualityValue = quality.url;
				}
			}
			iframeElement.contentWindow.postMessage(
				{
					type: 'qualityChange',
					quality: qualityValue
				},
				'*'
			);

			let subtitleValue = null;
			if (selectedSubtitle) {
				const subtitle = currentSubtitles.find((s) => s.id === selectedSubtitle);
				if (subtitle) {
					subtitleValue = {
						url: subtitle.url,
						language: subtitle.language,
						label: subtitle.label
					};
				}
			}
			iframeElement.contentWindow.postMessage(
				{
					type: 'subtitleChange',
					subtitle: subtitleValue
				},
				'*'
			);
		}
	}

	function toggleTheaterMode() {
		isTheaterMode = !isTheaterMode;
	}

	function togglePictureInPicture() {
		if (!iframeElement || typeof document === 'undefined') return;

		if (document.pictureInPictureElement) {
			document.exitPictureInPicture();
		} else if ('requestPictureInPicture' in iframeElement) {
			(iframeElement as any).requestPictureInPicture();
		}
	}

	function goToNextEpisode() {
		if (!movie?.seasons || mediaType !== 'tv') return;

		const currentSeasonData = movie.seasons.find((s) => s.seasonNumber === selectedSeason);
		if (!currentSeasonData) return;

		if (selectedEpisode < currentSeasonData.episodeCount) {
			handleEpisodeSelect(selectedEpisode + 1);
		} else {
			const nextSeason = movie.seasons.find((s) => s.seasonNumber === selectedSeason + 1);
			if (nextSeason) {
				selectedSeason = nextSeason.seasonNumber;
				selectedEpisode = 1;
				hasRequestedPlayback = false;
				currentStreaming = { source: null, resolutions: [] };
				if (selectedProvider) {
					requestProviderResolution(selectedProvider);
				}
			}
		}
	}

	function cancelAutoPlay() {
		if (autoPlayTimer) {
			clearTimeout(autoPlayTimer);
			autoPlayTimer = null;
		}
		showNextOverlay = false;
	}

	$effect(() => {
		if (nextEpTimer) clearTimeout(nextEpTimer);
		if (autoPlayTimer) clearTimeout(autoPlayTimer);
		showNextOverlay = false;

		if (displayPlayer && playbackUrl && movie?.durationMinutes && mediaType === 'tv') {
			const durationMs = movie.durationMinutes * 60 * 1000;
			const triggerTime = Math.max(0, durationMs - 30000);

			if (durationMs > 30000) {
				nextEpTimer = setTimeout(() => {
					showNextOverlay = true;
					if (isAutoPlay) {
						autoPlayTimer = setTimeout(() => {
							goToNextEpisode();
						}, 30000);
					}
				}, triggerTime);
			}
		}

		return () => {
			if (nextEpTimer) clearTimeout(nextEpTimer);
			if (autoPlayTimer) clearTimeout(autoPlayTimer);
		};
	});

	const notFoundHeading = $derived(mediaType === 'tv' ? 'Series Not Found' : 'Movie Not Found');
	const notFoundDescription = $derived(
		mediaType === 'tv'
			? 'The TV show you are looking for does not exist.'
			: 'The movie you are looking for does not exist.'
	);

	const breadcrumbItems = $derived.by(() => {
		if (!movie) return [];
		const items = [
			{
				label: mediaType === 'tv' ? 'TV Shows' : 'Movies',
				href: `/explore/${mediaType === 'tv' ? 'tv-shows' : 'movies'}`
			},
			{ label: movie.title, href: `/${mediaType}/${movie.id}` }
		];
		return items;
	});
</script>

{#if movie}
	<SEOHead
		title={movie.title}
		description={movie.overview ||
			`Watch ${movie.title} on MeatFlicks - Free streaming of movies and TV shows`}
		canonical={canonicalPath}
		ogType={mediaType === 'tv' ? 'video.tv_show' : 'video.movie'}
		ogImage={ogImage ?? undefined}
		ogImageAlt={`${movie.title} poster`}
		twitterCard="summary_large_image"
		keywords={[
			movie.title,
			...(movie.genres?.map((g) => g.name) || []),
			mediaType === 'tv' ? 'TV show' : 'movie',
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
		<main class="container mx-auto p-4">
			<Breadcrumbs items={breadcrumbItems} />
			<div class="relative mb-8 h-96 w-full">
				{#if movie.backdropPath}
					<img
						src={movie.backdropPath}
						alt={movie.title}
						class="h-full w-full rounded-lg object-cover"
					/>
				{/if}
				<div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent"></div>
				{#if movie.trailerUrl}
					<div class="absolute inset-0 flex items-center justify-center">
						<button
							onclick={() => window.open(movie.trailerUrl!, '_blank', 'noopener,noreferrer')}
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
							<h1 class="text-5xl font-bold text-foreground">{movie.title}</h1>
							{#if movie.rating}
								<div
									class="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1 backdrop-blur-sm"
								>
									<Star class="h-5 w-5 text-blue-500" />
									<span class="font-semibold">{movie.rating.toFixed(1)}</span>
								</div>
							{/if}
							{#if movie.imdbId}
								<a
									href={`https://www.imdb.com/title/${movie.imdbId}/`}
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
								{releaseYear} | {movie?.durationMinutes
									? `${movie.durationMinutes} min`
									: mediaType === 'tv'
										? 'Runtime varies'
										: 'N/A'}
							</p>
							{#if movie.genres?.length}
								<div class="flex flex-wrap gap-2">
									{#each movie.genres as genre (genre.id)}
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

			{#if displayPlayer}
				<div
					class={isTheaterMode
						? 'fixed inset-0 z-50 flex h-screen w-screen bg-black'
						: 'relative mb-8 aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl'}
				>
					{#if isTheaterMode}
						<button
							class="absolute top-6 right-6 z-50 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
							onclick={toggleTheaterMode}
							aria-label="Exit Theater Mode"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path
									d="M3 16h3a2 2 0 0 1 2 2v3"
								/><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg
							>
						</button>
					{/if}

					<!-- Player Controls -->
					{#if displayPlayer && (currentQualities.length > 1 || currentSubtitles.length > 0)}
						<PlayerControls
							qualities={currentQualities}
							subtitles={currentSubtitles}
							{selectedQuality}
							selectedSubtitle={selectedSubtitle ?? undefined}
							onQualityChange={handleQualityChange}
							onSubtitleChange={handleSubtitleChange}
							compact={true}
						/>
					{/if}

					{#if primarySource?.embedUrl}
						<iframe
							bind:this={iframeElement}
							src={playbackUrl!}
							title="Player"
							class="h-full w-full border-none"
							allowfullscreen
							allow="autoplay; fullscreen; picture-in-picture"
							onload={handleIframeLoad}
						></iframe>
					{:else}
						<div class="flex h-full w-full items-center justify-center text-white">
							<p>Stream not available for this provider.</p>
						</div>
					{/if}

					{#if showNextOverlay && mediaType === 'tv'}
						<div
							class="overlay-enter absolute right-6 bottom-6 z-40 w-80 overflow-hidden rounded-xl border border-white/10 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-md"
						>
							<div class="mb-4">
								<h4 class="text-xs font-semibold tracking-wider text-white/60 uppercase">
									Up Next
								</h4>
								<p class="mt-1 text-lg font-bold">{nextEpisodeLabel}</p>
							</div>

							<div class="flex items-center gap-3">
								<Button
									size="sm"
									class="w-full bg-white text-black hover:bg-gray-200"
									onclick={goToNextEpisode}
								>
									Play Now
								</Button>
								<Button
									size="sm"
									variant="outline"
									class="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
									onclick={cancelAutoPlay}
								>
									Cancel
								</Button>
							</div>

							{#if isAutoPlay}
								<div class="absolute bottom-0 left-0 h-1 w-full bg-white/10">
									<div class="animate-progress h-full origin-left bg-primary"></div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				{#if !isTheaterMode}
					<div
						class="mb-6 flex flex-wrap items-center justify-between gap-6 text-sm text-muted-foreground"
					>
						{#if providerResolutions.length}
							<div class="flex flex-wrap gap-2">
								{#each providerResolutions as resolution (resolution.providerId)}
									<Button
										variant={selectedProvider === resolution.providerId ? 'default' : 'outline'}
										class="rounded-lg"
										onclick={() => handleProviderSelectionChange(resolution.providerId)}
									>
										{resolution.label}
									</Button>
								{/each}
								{#if hasRequestedPlayback}
									<Button
										variant="outline"
										size="icon"
										onclick={handlePlayClick}
										disabled={isResolving}
										class="ml-auto"
										title="Reload Player"
									>
										<RefreshCw class="h-5 w-5" />
									</Button>
								{/if}
							</div>
						{/if}
						<div class="flex flex-wrap items-center gap-6">
							{#if playbackUrl}
								<Button variant="secondary" size="sm" onclick={handleOpenInNewTab}
									>Open in New Tab</Button
								>
							{/if}
							{#if mediaType === 'tv'}
								<label
									class="flex cursor-pointer items-center gap-2 transition-colors hover:text-foreground"
								>
									<Checkbox
										bind:checked={isAutoPlay}
										class="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary"
									/>
									<span>Auto-play Next</span>
								</label>
							{/if}
							<button
								onclick={togglePictureInPicture}
								class="flex items-center gap-2 transition-colors hover:text-foreground"
								disabled={typeof document === 'undefined' ||
									!('pictureInPictureEnabled' in document)}
							>
								<PictureInPicture class="h-4 w-4" />
								Picture-in-Picture
							</button>
							<Button
								variant="ghost"
								size="sm"
								onclick={toggleTheaterMode}
								class="flex items-center gap-2 transition-colors hover:text-foreground"
							>
								<MonitorPlay class="h-4 w-4" />
								Theater Mode
							</Button>
						</div>
					</div>
				{/if}
			{/if}

			{#if providerResolutions.length}
				<section class="mb-6">
					{#if resolveError}
						<p class="mt-2 text-sm text-destructive">{resolveError}</p>
					{/if}
				</section>
			{/if}

			{#if mediaType === 'tv' && movie.seasons}
				<section class="mb-8">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-xl font-semibold">Episodes</h3>
						<Select
							type="single"
							value={selectedSeason.toString()}
							onValueChange={handleSeasonChange}
						>
							<SelectTrigger class="w-48" aria-label="Select season">
								<span data-slot="select-value">
									{#if movie.seasons?.find((s) => s.seasonNumber === selectedSeason)}
										{movie.seasons.find((s) => s.seasonNumber === selectedSeason)?.name} ({movie.seasons.find(
											(s) => s.seasonNumber === selectedSeason
										)?.episodeCount} Episodes)
									{/if}
								</span>
							</SelectTrigger>
							<SelectContent>
								{#each movie.seasons as season (season.seasonNumber)}
									<SelectItem value={season.seasonNumber.toString()}>
										{season.name} ({season.episodeCount} Episodes)
									</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					{#if isLoadingEpisodes}
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each Array(5) as _}
								<Skeleton class="aspect-video rounded-md" />
							{/each}
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each episodesList as episode (episode.id)}
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

			<section class="grid gap-6 lg:grid-cols-[70%,30%]">
				<div class="space-y-4">
					<div class="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
						<div class="flex flex-col gap-4 lg:flex-row">
							<div class="flex-shrink-0 space-y-2 rounded-lg lg:w-[70%]">
								{#if movie.cast?.length}
									<ul class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
										{#each movie.cast as member (member.id)}
											<li
												class="rounded-lg border border-border/40 bg-background/80 p-4 transition-colors hover:bg-muted/50"
											>
												<a href={`/person/${member.id}`} class="flex items-center gap-3">
													{#if member.profilePath}
														<img
															src={member.profilePath.startsWith('http')
																? member.profilePath
																: `https://image.tmdb.org/t/p/w185${member.profilePath}`}
															alt={member.name}
															class="h-16 w-12 rounded-md object-cover"
															width="48"
															height="64"
														/>
													{:else}
														<div
															class="flex h-16 w-12 items-center justify-center rounded-md bg-muted"
														>
															<span class="text-xs text-muted-foreground">No Image</span>
														</div>
													{/if}
													<div class="flex-1">
														<p class="font-semibold text-foreground hover:underline">
															{member.name}
														</p>
														<p class="text-sm text-muted-foreground">{member.character}</p>
													</div>
												</a>
											</li>
										{/each}
									</ul>
								{/if}

								{#if movie.productionCompanies?.length}
									<div class="mt-6">
										<h2 class="mb-4 text-xl font-semibold">Production Companies</h2>
										<div class="flex flex-wrap gap-4">
											{#each movie.productionCompanies as company (company.id)}
												<Card class="p-3">
													<div class="flex items-center gap-2">
														{#if company.logoPath}
															<img
																src={company.logoPath}
																alt={company.name}
																class="h-6 object-contain"
															/>
														{/if}
														<span class="text-sm font-medium">{company.name}</span>
													</div>
												</Card>
											{/each}
										</div>
									</div>
								{/if}
							</div>
							<div class="flex flex-col items-center lg:w-[30%] lg:items-end">
								{#if movie.posterPath}
									<img
										src={movie.posterPath}
										alt={movie.title}
										class="mb-4 w-full max-w-sm rounded-lg object-cover"
									/>
								{/if}
								<div class="w-full max-w-sm">
									<h2 class="text-xl font-semibold">Overview</h2>
									<p class="text-sm text-muted-foreground">
										{movie.overview ?? 'No overview available.'}
									</p>
								</div>
							</div>
						</div>
					</div>
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

<style>
	@keyframes progress {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
	.animate-progress {
		animation: progress 30s linear forwards;
	}
	.overlay-enter {
		animation: slideUp 0.5s ease-out forwards;
	}
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
