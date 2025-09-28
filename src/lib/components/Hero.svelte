<script lang="ts">
  import {
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Pause,
    Play,
    Plus,
    Star
  } from '@lucide/svelte';
  import { watchlist } from '$lib/state/stores/watchlistStore';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import type { LibraryMovie } from '$lib/types/library';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

  type HeroProps = {
    movie?: LibraryMovie | null;
    movies?: LibraryMovie[] | null;
    autoPlayIntervalMs?: number;
  };

  type HeroSlide = {
    movie: LibraryMovie;
    key: string;
  };

  let { movie = null, movies = [], autoPlayIntervalMs = 7000 }: HeroProps = $props();

  let message = $state<string | null>(null);
  let isAutoPlaying = $state(true);
  let activeIndex = $state(0);
  let lastSlideKey = $state<string | null>(null);

  const watchlistEntries = $derived($watchlist.watchlist ?? []);

  function normaliseKey(entry: LibraryMovie, index: number): string {
    const candidates = [
      entry.id != null && entry.id !== '' ? `id-${String(entry.id)}` : '',
      entry.tmdbId != null ? `tmdb-${entry.tmdbId}` : '',
      entry.imdbId ? `imdb-${entry.imdbId}` : '',
      entry.title ? `title-${entry.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}` : ''
    ].filter(Boolean);

    if (candidates.length === 0) {
      return `slide-${index}`;
    }

    return candidates[0] ?? `slide-${index}`;
  }

  const slides = $derived((() => {
    const pooled: HeroSlide[] = [];
    const seen = new Set<string>();
    const sources = [
      ...(movie ? [movie] : []),
      ...(Array.isArray(movies) ? movies : [])
    ];

    sources.forEach((entry, index) => {
      if (!entry) return;

      let key = normaliseKey(entry, index);
      let suffix = 1;
      while (seen.has(key)) {
        key = `${key}-${suffix}`;
        suffix += 1;
      }

      seen.add(key);
      pooled.push({ movie: entry, key });
    });

    return pooled.slice(0, 5);
  })());

  const hasSlides = $derived(slides.length > 0);
  const isMultiSlide = $derived(slides.length > 1);

  const activeSlide = $derived(slides[activeIndex] ?? slides[0] ?? null);
  const activeMovie = $derived(activeSlide?.movie ?? null);

  const safeInterval = $derived((() => {
    const fallback = 7000;
    const numeric = Number(autoPlayIntervalMs);
    return Number.isFinite(numeric) && numeric >= 1000 ? numeric : fallback;
  })());

  const mediaTypeLabel = $derived((() => {
    const current = activeMovie;
    if (!current) return 'Movie';

    const raw = (current.media_type ?? 'movie').toLowerCase();
    if (raw === 'tv') return 'TV Series';
    if (raw === 'anime') return 'Anime';
    if (raw === 'manga') return 'Manga';
    return 'Movie';
  })());

  const releaseDateLabel = $derived((() => {
    const current = activeMovie;
    if (!current?.releaseDate) {
      return 'Unknown release';
    }

    const releaseDate = new Date(current.releaseDate);

    if (Number.isNaN(releaseDate.getTime())) {
      return String(current.releaseDate);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(releaseDate);
  })());

  const ratingLabel = $derived((() => {
    const rating = typeof activeMovie?.rating === 'number' ? activeMovie.rating : null;
    return rating && rating > 0 ? rating.toFixed(1) : 'NR';
  })());

  const detailsHref = $derived((() => {
    const current = activeMovie;
    if (!current) return '#';

    return (
      current.canonicalPath ??
      (current.imdbId
        ? `/movie/${current.imdbId}`
        : current.tmdbId
          ? `/movie/${current.tmdbId}`
          : `/movie/${current.id}`)
    );
  })());

  const isInWatchlist = $derived((() => {
    const current = activeMovie;
    if (!current) return false;

    const id = String(current.id ?? '');
    if (!id) return false;

    return watchlistEntries.some((entry) => entry.id === id);
  })());

  const backgroundImageUrl = $derived((() => {
    const current = activeMovie;
    const source = current?.backdropPath ?? (current?.posterPath ? current.posterPath : null);

    if (!source) return null;

    return source.startsWith('http')
      ? source
      : `https://image.tmdb.org/t/p/original${source}`;
  })());

  const backgroundStyle = $derived(
    backgroundImageUrl ? `background-image: url(${backgroundImageUrl})` : undefined
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

  function handleWatchlistToggle() {
    const current = activeMovie;

    if (!current) {
      message = 'No movie selected.';
      return;
    }

    try {
      const id = String(current.id ?? '');
      if (!id) {
        message = 'Missing movie identifier.';
        return;
      }

      if (isInWatchlist) {
        watchlist.removeFromWatchlist(id);
        message = 'Removed from watchlist.';
      } else {
        watchlist.addToWatchlist(current);
        message = 'Added to watchlist!';
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
      message = 'Failed to update watchlist.';
    }
  }

  $effect(() => {
    if (slides.length === 0) {
      activeIndex = 0;
      return;
    }

    if (activeIndex > slides.length - 1) {
      activeIndex = 0;
    }
  });

  $effect(() => {
    if (!isMultiSlide && isAutoPlaying) {
      isAutoPlaying = false;
    }
  });

  $effect(() => {
    if (!isAutoPlaying || !isMultiSlide) {
      return;
    }

    const timer = setInterval(() => {
      showNext();
    }, safeInterval);

    return () => clearInterval(timer);
  });

  $effect(() => {
    if (!message) return;
    const timeout = setTimeout(() => {
      message = null;
    }, 3200);

    return () => clearTimeout(timeout);
  });

  $effect(() => {
    if ($watchlist?.error) {
      message = $watchlist.error;
    }
  });

  $effect(() => {
    const key = activeSlide?.key ?? null;
    if (lastSlideKey !== key) {
      lastSlideKey = key;
      message = null;
    }
  });
</script>

{#if hasSlides && activeMovie}
  <Card
    class="relative min-h-[60vh] overflow-hidden border-0 bg-transparent bg-cover bg-center bg-no-repeat p-0 md:min-h-[65vh] lg:min-h-[70vh]"
    style={backgroundStyle}
  >
    <div class="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent"></div>

    <div class="absolute left-[5%] top-8 z-20 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

    {#if isMultiSlide}
      <div class="absolute right-[5%] top-8 z-20 flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          class="rounded-full border border-foreground/20 bg-background/50 text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
          onclick={toggleAutoplay}
          aria-pressed={isAutoPlaying}
          aria-label={isAutoPlaying ? 'Pause hero autoplay' : 'Resume hero autoplay'}
        >
          {#if isAutoPlaying}
            <Pause class="size-4" />
          {:else}
            <Play class="size-4" />
          {/if}
        </Button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        class="absolute left-[3%] top-1/2 hidden -translate-y-1/2 rounded-full border border-foreground/20 bg-background/60 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary md:flex"
        onclick={showPrevious}
        aria-label="Show previous spotlight"
      >
        <ChevronLeft class="size-5" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        class="absolute right-[3%] top-1/2 hidden -translate-y-1/2 rounded-full border border-foreground/20 bg-background/60 text-foreground shadow-lg backdrop-blur transition hover:border-primary/40 hover:text-primary md:flex"
        onclick={showNext}
        aria-label="Show next spotlight"
      >
        <ChevronRight class="size-5" />
      </Button>
    {/if}

    <div class="relative z-10 flex h-full items-end px-[5%] py-12">
      <CardContent class="max-w-2xl space-y-6 px-0 text-foreground">
        <CardHeader class="space-y-4 px-0">
          <CardTitle class="text-4xl font-bold leading-tight sm:text-5xl">
            {activeMovie.title}
          </CardTitle>

          <div class="flex flex-wrap items-center gap-3 text-sm">
            <Badge
              variant="secondary"
              class="bg-foreground/10 text-foreground backdrop-blur"
            >
              {mediaTypeLabel}
            </Badge>

            <Badge
              variant="outline"
              class="flex items-center gap-1 border-foreground/20 bg-background/40 text-foreground backdrop-blur"
            >
              <CalendarDays class="size-3.5" />
              {releaseDateLabel}
            </Badge>

            <Badge
              variant="outline"
              class="flex items-center gap-1 border-foreground/20 bg-background/40 text-foreground backdrop-blur"
            >
              <Star class="size-3.5 text-yellow-400" />
              {ratingLabel}
            </Badge>
          </div>
        </CardHeader>

        <p class="text-base leading-relaxed text-foreground/90 md:text-lg">
          {activeMovie.overview}
        </p>

        <div class="flex flex-wrap items-center gap-4">
          <Button
            href={detailsHref}
            size="lg"
            class="gap-2 font-semibold transition-transform duration-300 hover:-translate-y-0.5"
          >
            <Play class="size-4" />
            Play
          </Button>

          <Button
            type="button"
            size="icon"
            variant={isInWatchlist ? 'destructive' : 'secondary'}
            onclick={handleWatchlistToggle}
            aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            class="size-11 cursor-pointer rounded-full border border-foreground/20 bg-background/40 text-foreground backdrop-blur transition-transform duration-300 hover:-translate-y-0.5"
          >
            {#if isInWatchlist}
              <Check class="size-4" />
            {:else}
              <Plus class="size-4" />
            {/if}
          </Button>
        </div>

        {#if message}
          <div class="text-sm font-medium text-foreground/80">
            {message}
          </div>
        {/if}
      </CardContent>
    </div>

    {#if isMultiSlide}
      <div class="absolute inset-x-[5%] bottom-8 z-20 flex flex-wrap justify-center gap-2">
        {#each slides as slide, index (slide.key)}
          <button
            type="button"
            class={`group flex max-w-[14rem] items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur transition-colors duration-300 ${index === activeIndex ? 'border-primary/70 bg-background/70 text-primary shadow-sm' : 'border-foreground/20 bg-background/40 text-foreground/80 hover:border-foreground/40 hover:text-foreground'}`}
            onclick={() => goToSlide(index)}
            aria-current={index === activeIndex}
            aria-label={`Show ${slide.movie.title}`}
          >
            <span class={`size-2 rounded-full ${index === activeIndex ? 'bg-primary' : 'bg-foreground/40 group-hover:bg-foreground/70'}`}></span>
            <span class="truncate">
              {slide.movie.title}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </Card>
{:else}
  <Card class="relative flex min-h-[50vh] items-center justify-center overflow-hidden border-0 bg-gradient-to-br from-background via-background/90 to-background px-[5%] py-24 text-center text-foreground/70">
    <div class="space-y-3">
      <h2 class="text-3xl font-semibold">Stay tuned</h2>
      <p class="mx-auto max-w-xl text-sm text-foreground/60">
        Featured picks will appear here once we discover something worth spotlighting.
      </p>
    </div>
  </Card>
{/if}
