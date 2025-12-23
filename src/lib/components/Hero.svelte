<script lang="ts">
	import {
		CalendarDays,
		Check,
		ChevronLeft,
		ChevronRight,
		Pause,
		Play,
		Plus,
		Star,
		Clapperboard,
		RefreshCcw,
		LoaderCircle
	} from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import type { LibraryMovie } from '$lib/types/library';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	type HeroProps = {
		movie?: LibraryMovie | null;
		movies?: LibraryMovie[] | null;
		autoPlayIntervalMs?: number;
		onRefresh?: (() => void | Promise<void>) | null;
		refreshing?: boolean;
	};

	type HeroSlide = {
		movie: LibraryMovie;
		key: string;
	};

	type MediaType = 'tv' | 'anime' | 'manga' | 'movie';

	const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
		tv: 'TV Series',
		anime: 'Anime',
		manga: 'Manga',
		movie: 'Movie'
	};

	const MIN_INTERVAL_MS = 1000;
	const DEFAULT_INTERVAL_MS = 7000;
	const MAX_SLIDES = 5;
	const MESSAGE_DURATION_MS = 3200;

	let {
		movie = null,
		movies = [],
		autoPlayIntervalMs = DEFAULT_INTERVAL_MS,
		onRefresh = null,
		refreshing = false
	}: HeroProps = $props();

	let message = $state<string | null>(null);
	let isAutoPlaying = $state(true);
	let activeIndex = $state(0);
	let lastSlideKey = $state<string | null>(null);
	let heroElement = $state<HTMLElement | null>(null);

	function normalizeKey(entry: LibraryMovie, index: number): string {
		const candidates = [
			entry.id ? `id-${String(entry.id)}` : '',
			entry.tmdbId ? `tmdb-${entry.tmdbId}` : '',
			entry.imdbId ? `imdb-${entry.imdbId}` : '',
			entry.title ? `title-${entry.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}` : ''
		].filter(Boolean);

		return candidates[0] || `slide-${index}`;
	}

	function extractYouTubeVideoId(url: string): string | null {
		if (!url) return null;

		try {
			const parsed = new URL(url);
			const host = parsed.hostname.toLowerCase();

			if (host.includes('youtu.be')) {
				return parsed.pathname.slice(1).trim() || null;
			}

			const pathSegments = parsed.pathname.split('/').filter(Boolean);
			if (pathSegments.length >= 2 && pathSegments[0] === 'embed') {
				return pathSegments[1] || null;
			}

			const queryId = parsed.searchParams.get('v');
			if (queryId) return queryId;
		} catch {
			const match = url.match(/(?:v=|be\/|embed\/)([A-Za-z0-9_-]{6,})/);
			return match?.[1] || null;
		}

		return null;
	}

	function formatReleaseDate(dateInput: string | Date | null | undefined): string {
		if (!dateInput) return 'Unknown release';

		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		if (Number.isNaN(date.getTime())) return String(dateInput);

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}

	function getMediaTypeLabel(type: string | null | undefined): string {
		const normalized = (type || 'movie').toLowerCase() as MediaType;
		return MEDIA_TYPE_LABELS[normalized] || MEDIA_TYPE_LABELS.movie;
	}

	const slides = $derived.by(() => {
		const pooled: HeroSlide[] = [];
		const seen = new SvelteSet<string>();
		const sources = [...(movie ? [movie] : []), ...(Array.isArray(movies) ? movies : [])];

		sources.forEach((entry, index) => {
			if (!entry) return;

			let key = normalizeKey(entry, index);
			let suffix = 1;
			while (seen.has(key)) {
				key = `${normalizeKey(entry, index)}-${suffix}`;
				suffix += 1;
			}

			seen.add(key);
			pooled.push({ movie: entry, key });
		});

		return pooled.slice(0, MAX_SLIDES);
	});

	const hasSlides = $derived(slides.length > 0);
	const isMultiSlide = $derived(slides.length > 1);
	const canRefresh = $derived(typeof onRefresh === 'function');
	const activeSlide = $derived(slides[activeIndex] ?? slides[0] ?? null);
	const activeMovie = $derived(activeSlide?.movie ?? null);

	const safeInterval = $derived.by(() => {
		const numeric = Number(autoPlayIntervalMs);
		return Number.isFinite(numeric) && numeric >= MIN_INTERVAL_MS ? numeric : DEFAULT_INTERVAL_MS;
	});

	const mediaTypeLabel = $derived(getMediaTypeLabel(activeMovie?.media_type));
	const releaseDateLabel = $derived(formatReleaseDate(activeMovie?.releaseDate));

	const ratingLabel = $derived.by(() => {
		const rating = typeof activeMovie?.rating === 'number' ? activeMovie.rating : null;
		return rating && rating > 0 ? rating.toFixed(1) : 'NR';
	});

	const detailsHref = $derived(
		activeMovie?.id ? (activeMovie.canonicalPath ?? `/movie/${activeMovie.id}`) : '#'
	);

	const isInWatchlist = $derived(activeMovie ? watchlist.isInWatchlist(activeMovie.id) : false);

	const backgroundImageUrl = $derived.by(() => {
		const source = activeMovie?.backdropPath ?? activeMovie?.posterPath ?? null;
		if (!source) return null;
		return source.startsWith('http') ? source : `https://image.tmdb.org/t/p/original${source}`;
	});

	const backgroundStyle = $derived(
		backgroundImageUrl ? `background-image: url(${backgroundImageUrl})` : undefined
	);

	const trailerVideoId = $derived(extractYouTubeVideoId(activeMovie?.trailerUrl ?? ''));

	const trailerEmbedUrl = $derived.by(() => {
		if (!trailerVideoId) return null;

		try {
			const embed = new URL(`https://www.youtube.com/embed/${trailerVideoId}`);
			embed.searchParams.set('autoplay', '1');
			embed.searchParams.set('mute', '1');
			embed.searchParams.set('playsinline', '1');
			embed.searchParams.set('controls', '0');
			embed.searchParams.set('rel', '0');
			embed.searchParams.set('loop', '1');
			embed.searchParams.set('modestbranding', '1');
			embed.searchParams.set('playlist', trailerVideoId);
			return embed.toString();
		} catch {
			return null;
		}
	});

	const trailerWatchUrl = $derived(
		trailerVideoId ? `https://www.youtube.com/watch?v=${trailerVideoId}` : null
	);

	function goToSlide(index: number) {
		if (!slides.length) return;
		const length = slides.length;
		const nextIndex = ((index % length) + length) % length;
		activeIndex = nextIndex;
	}

	function showNext() {
		goToSlide(activeIndex + 1);
	}

	function showPrevious() {
		goToSlide(activeIndex - 1);
	}

	function toggleAutoplay() {
		if (!isMultiSlide) return;
		isAutoPlaying = !isAutoPlaying;
	}

	async function triggerRefresh() {
		if (typeof onRefresh !== 'function' || refreshing) return;

		try {
			const outcome = onRefresh();
			if (outcome instanceof Promise) {
				await outcome;
			}
		} catch (error) {
			console.error('Failed to refresh:', error);
			message = 'Failed to refresh. Please try again.';
		}
	}

	function handleWatchlistToggle() {
		if (!activeMovie) {
			message = 'No movie selected.';
			return;
		}

		try {
			const id = String(activeMovie.id ?? '');
			if (!id) {
				message = 'Missing movie identifier.';
				return;
			}

			if (isInWatchlist) {
				watchlist.removeFromWatchlist(id);
				message = 'Removed from watchlist.';
			} else {
				watchlist.addToWatchlist(activeMovie);
				message = 'Added to watchlist!';
			}
		} catch (error) {
			console.error('Failed to update watchlist:', error);
			message = 'Failed to update watchlist.';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isMultiSlide) return;

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				showPrevious();
				break;
			case 'ArrowRight':
				event.preventDefault();
				showNext();
				break;
			case ' ':
				if (event.target === heroElement) {
					event.preventDefault();
					toggleAutoplay();
				}
				break;
		}
	}

	$effect(() => {
		if (slides.length === 0) {
			activeIndex = 0;
		} else if (activeIndex >= slides.length) {
			activeIndex = 0;
		}
	});

	$effect(() => {
		if (!isMultiSlide && isAutoPlaying) {
			isAutoPlaying = false;
		}
	});

	$effect(() => {
		if (!isAutoPlaying || !isMultiSlide) return;

		const timer = setInterval(showNext, safeInterval);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (!message) return;

		const timeout = setTimeout(() => {
			message = null;
		}, MESSAGE_DURATION_MS);

		return () => clearTimeout(timeout);
	});

	$effect(() => {
		const key = activeSlide?.key ?? null;
		if (lastSlideKey !== key) {
			lastSlideKey = key;
			message = null;
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if hasSlides && activeMovie}
	<Card
		class="rounded-b-0 relative min-h-[60vh] overflow-hidden border-0 bg-black bg-cover bg-center bg-no-repeat p-0 md:min-h-[65vh] lg:min-h-[70vh]"
		style={trailerEmbedUrl ? undefined : backgroundStyle}
		role="region"
		aria-label="Featured content spotlight"
		tabindex={isMultiSlide ? 0 : -1}
	>
		<div bind:this={heroElement} class="contents">
			{#if trailerEmbedUrl}
				<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
					<iframe
						title={`Trailer for ${activeMovie.title}`}
						src={trailerEmbedUrl}
						allow="autoplay; fullscreen; picture-in-picture"
						class="h-full w-full scale-125 md:scale-110"
					></iframe>
				</div>
			{:else if backgroundImageUrl}
				<img
					src={backgroundImageUrl}
					alt=""
					loading="lazy"
					aria-hidden="true"
					class="absolute inset-0 -z-10 h-full w-full object-cover"
				/>
			{/if}

			<div
				class="absolute inset-0 bg-gradient-to-t from-background/50 via-background/40 to-transparent"
			></div>
			<div
				class="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent"
			></div>
			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background via-background/90 to-transparent"
			></div>

			<div
				class="absolute top-8 left-[5%] z-20 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
			>
				<Badge
					variant="secondary"
					class="rounded-full bg-background/60 text-foreground backdrop-blur"
				>
					Spotlight
				</Badge>
				{#if isMultiSlide}
					<Badge
						variant="outline"
						class="rounded-full border-foreground/20 bg-background/50 text-foreground backdrop-blur"
					>
						{activeIndex + 1} / {slides.length}
					</Badge>
				{/if}
			</div>

			{#if isMultiSlide || canRefresh}
				<div class="absolute top-8 right-[5%] z-20 flex items-center gap-2">
					{#if canRefresh}
						<Button
							type="button"
							variant="secondary"
							size="sm"
							class="flex items-center gap-2 rounded-full border border-foreground/20 bg-background/50 text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
							onclick={triggerRefresh}
							disabled={refreshing}
							aria-label="Refresh spotlight picks"
							title="Refresh spotlight picks"
						>
							{#if refreshing}
								<LoaderCircle class="size-4 animate-spin" />
							{:else}
								<RefreshCcw class="size-4" />
							{/if}
							<span class="hidden text-xs font-semibold tracking-wide uppercase sm:inline">
								Refresh
							</span>
						</Button>
					{/if}

					{#if isMultiSlide}
						<Button
							type="button"
							variant="secondary"
							size="icon"
							class="rounded-full border border-foreground/20 bg-background/50 text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
							onclick={toggleAutoplay}
							aria-pressed={isAutoPlaying}
							aria-label={isAutoPlaying ? 'Pause autoplay' : 'Resume autoplay'}
							title={isAutoPlaying ? 'Pause autoplay (Space)' : 'Resume autoplay (Space)'}
						>
							{#if isAutoPlaying}
								<Pause class="size-4" />
							{:else}
								<Play class="size-4" />
							{/if}
						</Button>
					{/if}
				</div>
			{/if}

			{#if isMultiSlide}
				<Button
					type="button"
					variant="secondary"
					size="icon"
					class="absolute top-1/2 left-[3%] hidden -translate-y-1/2 rounded-full border border-foreground/20 bg-background/60 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary md:flex"
					onclick={showPrevious}
					aria-label="Previous slide (Left arrow)"
					title="Previous slide (Left arrow)"
				>
					<ChevronLeft class="size-5" />
				</Button>

				<Button
					type="button"
					variant="secondary"
					size="icon"
					class="absolute top-1/2 right-[3%] hidden -translate-y-1/2 rounded-full border border-foreground/20 bg-background/60 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary md:flex"
					onclick={showNext}
					aria-label="Next slide (Right arrow)"
					title="Next slide (Right arrow)"
				>
					<ChevronRight class="size-5" />
				</Button>
			{/if}

			<div class="relative z-10 flex h-full items-end px-[5%] py-12">
				<CardContent class="max-w-2xl space-y-6 px-0 text-foreground">
					<CardHeader class="space-y-4 px-0">
						<CardTitle class="text-4xl leading-tight font-bold sm:text-5xl">
							{activeMovie.title}
						</CardTitle>

						<div class="flex flex-wrap items-center gap-3 text-sm">
							<Badge variant="secondary" class="bg-foreground/10 text-foreground backdrop-blur">
								{mediaTypeLabel}
							</Badge>

							<Badge
								variant="outline"
								class="flex items-center gap-1 border-foreground/20 bg-background/40 text-foreground backdrop-blur"
							>
								<CalendarDays class="size-3.5" aria-hidden="true" />
								<span>{releaseDateLabel}</span>
							</Badge>

							<Badge
								variant="outline"
								class="flex items-center gap-1 border-foreground/20 bg-background/40 text-foreground backdrop-blur"
							>
								<Star class="size-3.5 text-yellow-400" aria-hidden="true" />
								<span>{ratingLabel}</span>
							</Badge>
						</div>
					</CardHeader>

					{#if activeMovie.overview}
						<p class="text-base leading-relaxed text-foreground/90 md:text-lg">
							{activeMovie.overview}
						</p>
					{/if}

					<div class="flex flex-wrap items-center gap-4">
						<Button
							href={detailsHref}
							size="lg"
							class="gap-2 font-semibold transition-transform duration-300 hover:-translate-y-0.5"
						>
							<Play class="size-4" aria-hidden="true" />
							Play
						</Button>

						{#if trailerWatchUrl}
							<Button
								href={trailerWatchUrl}
								variant="secondary"
								size="lg"
								target="_blank"
								rel="noopener noreferrer"
								class="gap-2 font-semibold transition-transform duration-300 hover:-translate-y-0.5"
							>
								<Clapperboard class="size-4" aria-hidden="true" />
								Watch Trailer
							</Button>
						{/if}

						<Button
							type="button"
							size="icon"
							variant={isInWatchlist ? 'destructive' : 'secondary'}
							onclick={handleWatchlistToggle}
							aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
							class="size-11 cursor-pointer rounded-full border border-foreground/20 bg-background/40 text-foreground backdrop-blur transition-transform duration-300 hover:-translate-y-0.5"
						>
							{#if isInWatchlist}
								<Check class="size-4" aria-hidden="true" />
							{:else}
								<Plus class="size-4" aria-hidden="true" />
							{/if}
						</Button>
					</div>

					{#if message}
						<div
							class="text-sm font-medium text-foreground/80"
							role="status"
							aria-live="polite"
							aria-atomic="true"
						>
							{message}
						</div>
					{/if}
				</CardContent>
			</div>

			{#if isMultiSlide}
				<div
					class="absolute inset-x-[5%] bottom-8 z-20 flex flex-wrap justify-center gap-2"
					role="tablist"
					aria-label="Slide navigation"
				>
					{#each slides as slide, index (slide.key)}
						<button
							type="button"
							role="tab"
							aria-selected={index === activeIndex}
							aria-controls={`slide-${slide.key}`}
							aria-label={`Go to slide ${index + 1}`}
							class={`group flex max-w-[14rem] items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur transition-colors duration-300 ${
								index === activeIndex
									? 'bg-background/70 text-primary shadow-sm'
									: 'bg-background/40 text-foreground/80 hover:text-foreground'
							}`}
							onclick={() => goToSlide(index)}
						>
							<span
								class={`size-3 shrink-0 rounded-full transition-colors duration-200 ${
									index === activeIndex
										? 'bg-primary'
										: 'bg-foreground/40 group-hover:bg-foreground/70'
								}`}
								aria-hidden="true"
							></span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</Card>
{:else}
	<Card
		class="relative flex min-h-[50vh] items-center justify-center overflow-hidden border-0 bg-gradient-to-br from-background via-background/90 to-background px-[5%] py-24 text-center text-foreground/70"
	>
		<div class="space-y-3">
			<h2 class="text-3xl font-semibold">Stay tuned</h2>
			<p class="mx-auto max-w-xl text-sm text-foreground/60">
				Featured picks will appear here once we discover something worth spotlighting.
			</p>
		</div>
	</Card>
{/if}
