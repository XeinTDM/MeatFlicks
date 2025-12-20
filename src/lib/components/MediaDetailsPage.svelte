<script lang="ts">
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource, VideoQuality, SubtitleTrack } from '$lib/streaming';
	import { Button } from '$lib/components/ui/button';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import { MovieScrollContainer } from '$lib/components';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import PlayerControls from '$lib/components/player/PlayerControls.svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import { StructuredData, Breadcrumbs, SEOHead } from '$lib/components/seo';
	import { PictureInPicture, Gauge } from '@lucide/svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

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
		productionCompanies?: { id: number; name: string; logoPath: string | null }[];
		productionCountries?: { iso: string; name: string }[];
		originCountry?: string[];
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

	function stopProgressTracking() {
		if (progressSaveInterval) {
			clearInterval(progressSaveInterval);
			progressSaveInterval = null;
		}
	}

	$effect(() => {
		// Track all reactive variables used in the interval
		// This ensures the effect re-runs when any of these change
		const currentDisplayPlayer = displayPlayer;
		const currentMovie = movie;
		const currentMediaType = mediaType;
		const currentSelectedSeason = selectedSeason;
		const currentSelectedEpisode = selectedEpisode;

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
								progress: Math.floor(duration * 0.1), // Placeholder - would be actual progress
								duration,
								seasonNumber: mediaType === 'tv' ? selectedSeason : undefined,
								episodeNumber: mediaType === 'tv' ? selectedEpisode : undefined
							})
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
					if (currentDisplayPlayer && 'pictureInPictureEnabled' in document) {
						event.preventDefault();
					}
					break;
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

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
					preferredQuality: selectedQuality,
					preferredSubtitleLanguage: selectedSubtitle,
					includeQualities: true,
					includeSubtitles: true,
					preferredProviders: providerId ? [providerId] : undefined
				})
			});

			if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

			const payload = await response.json();

			// Update qualities and subtitles from the response
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

	function handleSeasonChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		selectedSeason = Number(target.value);
		selectedEpisode = 1;
		hasRequestedPlayback = false;
		currentStreaming = { source: null, resolutions: [] };
		currentQualities = [];
		currentSubtitles = [];
	}

	function handleQualityChange(quality: VideoQuality) {
		selectedQuality = quality.label;
		// Update the stream URL if we have the same source
		if (primarySource && currentQualities.some((q) => q.url === quality.url)) {
			playbackUrl = quality.url;
			// In a real implementation, we would communicate with the iframe
			// to change the video source using postMessage
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
		// In a real implementation, we would communicate with the iframe
		// to enable/disable subtitles using postMessage
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

	function toggleTheaterMode() {
		isTheaterMode = !isTheaterMode;
	}

	function goToNextEpisode() {
		if (!movie?.seasons || mediaType !== 'tv') return;

		const currentSeasonData = movie.seasons.find((s) => s.seasonNumber === selectedSeason);
		if (!currentSeasonData) return;

		if (selectedEpisode < currentSeasonData.episodeCount) {
			handleEpisodeSelect(selectedEpisode + 1);
		} else {
			// Check next season
			const nextSeason = movie.seasons.find((s) => s.seasonNumber === selectedSeason + 1);
			if (nextSeason) {
				selectedSeason = nextSeason.seasonNumber;
				selectedEpisode = 1;
				hasRequestedPlayback = false;
				currentStreaming = { source: null, resolutions: [] };
				// This needs to wait for reactive updates?
				// Actually selectedProvider is state, so we can just request resolution
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
		// Cleanup timers on changes
		if (nextEpTimer) clearTimeout(nextEpTimer);
		if (autoPlayTimer) clearTimeout(autoPlayTimer);
		showNextOverlay = false;

		if (displayPlayer && playbackUrl && movie?.durationMinutes && mediaType === 'tv') {
			// Best-effort "nearing end" detection
			const durationMs = movie.durationMinutes * 60 * 1000;
			// Trigger overlay 30s before end
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
				<div class="absolute bottom-4 left-4">
					<h1 class="text-5xl font-bold text-foreground">{movie.title}</h1>
					<p class="text-xl text-gray-300">
						{releaseYear} | {runtimeLabel}
					</p>
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
					<div class="mb-6 flex items-center justify-end gap-6 text-sm text-muted-foreground">
						{#if mediaType === 'tv'}
							<label
								class="flex cursor-pointer items-center gap-2 transition-colors hover:text-foreground"
							>
								<input
									type="checkbox"
									checked={isAutoPlay}
									onchange={(e) => (isAutoPlay = e.currentTarget.checked)}
									class="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary"
								/>
								<span>Auto-play Next</span>
							</label>
						{/if}
						<button
							onclick={toggleTheaterMode}
							class="flex items-center gap-2 transition-colors hover:text-foreground"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8" /><path
									d="M12 17v4"
								/></svg
							>
							Theater Mode
						</button>
					</div>
				{/if}
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
									<li
										class="rounded-md border border-border/40 bg-background/80 px-3 py-2 transition-colors hover:bg-muted/50"
									>
										<a href={`/person/${member.id}`} class="block">
											<p class="font-semibold text-foreground hover:underline">{member.name}</p>
											<p class="text-xs text-muted-foreground">{member.character}</p>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if movie.productionCompanies?.length}
						<div class="rounded-lg border border-border/50 bg-muted/20 p-6">
							<h2 class="mb-4 text-xl font-semibold">Production Companies</h2>
							<div class="flex flex-wrap gap-4">
								{#each movie.productionCompanies as company}
									<div
										class="flex items-center gap-2 rounded-md border border-border/40 bg-background/80 px-3 py-2"
									>
										{#if company.logoPath}
											<img src={company.logoPath} alt={company.name} class="h-6 object-contain" />
										{/if}
										<span class="text-sm font-medium">{company.name}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if movie.productionCountries?.length || movie.originCountry?.length}
						<div class="rounded-lg border border-border/50 bg-muted/20 p-6">
							<h2 class="mb-4 text-xl font-semibold">Country of Origin</h2>
							<ul class="flex flex-wrap gap-2">
								{#if movie.productionCountries}
									{#each movie.productionCountries as country}
										<li class="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
											{country.name}
										</li>
									{/each}
								{/if}
								{#if movie.originCountry}
									{#each movie.originCountry as countryCode}
										<li class="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
											{countryCode}
										</li>
									{/each}
								{/if}
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
