<script lang="ts">
  import {
    Clapperboard,
    Search,
    Sparkles,
    Star,
    TrendingUp
  } from '@lucide/svelte';
  import Hero from '$lib/components/Hero.svelte';
  import CarouselContainer from '$lib/components/CarouselContainer.svelte';
  import MovieCard from '$lib/components/MovieCard.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
  import { Separator } from '$lib/components/ui/separator';
  import type { LibraryMovie } from '$lib/types/library';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  const categoryTitle = $derived(data.categoryTitle ?? 'Explore');
  const genreData = $derived(Array.isArray(data.genreData) ? data.genreData : []);
  const hasContent = $derived(Boolean(data.hasContent && genreData.length > 0));
  const singleGenreMode = $derived(Boolean(data.singleGenreMode));
  const primaryGenre = $derived(genreData[0]);

  const numberFormatter = new Intl.NumberFormat('en-US');
  function normalizeId(movie: LibraryMovie): string {
    if (typeof movie.id === 'string' && movie.id) return movie.id;
    if (typeof movie.id === 'number') return `id-${movie.id}`;
    if (typeof movie.tmdbId === 'number') return `tmdb-${movie.tmdbId}`;
    if (typeof movie.tmdbId === 'string') return `tmdb-${movie.tmdbId}`;
    if (typeof movie.imdbId === 'string') return `imdb-${movie.imdbId}`;
    return `title-${movie.title}`;
  }

  function toTimestamp(value: LibraryMovie['releaseDate']): number {
    if (!value) return 0;
    const date = new Date(value as string);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function getRatingValue(movie: LibraryMovie | null | undefined): number | null {
    const rating = movie?.rating;
    return typeof rating === 'number' && Number.isFinite(rating) ? rating : null;
  }

  function getMediaTypeLabel(type: string): string {
    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'movie':
        return 'Movies';
      case 'tv':
      case 'tv_show':
      case 'tv-shows':
        return 'TV Shows';
      case 'anime':
        return 'Anime';
      case 'manga':
        return 'Manga';
      case 'ova':
        return 'OVA';
      case 'ona':
        return 'ONA';
      default:
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }

  const uniqueMovies = $derived((() => {
    const lookup = new Map<string, LibraryMovie>();
    for (const genre of genreData) {
      for (const movie of genre?.movies ?? []) {
        if (!movie) continue;
        const key = normalizeId(movie);
        if (!lookup.has(key)) {
          lookup.set(key, movie);
        }
      }
    }
    return Array.from(lookup.values());
  })());

  const totalTitles = $derived(uniqueMovies.length);
  const ratedMovies = $derived(uniqueMovies.filter((movie) => getRatingValue(movie) !== null));
  const averageRating = $derived((() => {
    if (!ratedMovies.length) return null;
    const total = ratedMovies.reduce((sum, movie) => sum + (getRatingValue(movie) ?? 0), 0);
    return total / ratedMovies.length;
  })());

  const sortedByRating = $derived((() => {
    const entries = [...uniqueMovies];
    entries.sort((a, b) => {
      const ratingA = getRatingValue(a) ?? 0;
      const ratingB = getRatingValue(b) ?? 0;
      if (ratingA === ratingB) {
        return toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
      }
      return ratingB - ratingA;
    });
    return entries;
  })());

  const topRatedMovie = $derived(sortedByRating.find((movie) => getRatingValue(movie) !== null) ?? null);
  const highlightMovie = $derived((() => {
    for (const movie of sortedByRating) {
      if (movie?.backdropPath) {
        return movie;
      }
    }
    return sortedByRating[0] ?? null;
  })());

  const releaseSorted = $derived((() => {
    const entries = [...uniqueMovies];
    entries.sort((a, b) => toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate));
    return entries;
  })());

  const topGenres = $derived((() => {
    const sorted = [...genreData];
    sorted.sort((a, b) => (b?.movies?.length ?? 0) - (a?.movies?.length ?? 0));
    return sorted.slice(0, 3).map((entry) => entry.genre);
  })());

  const mediaTypeCounts = $derived((() => {
    const counts = new Map<string, { label: string; total: number }>();
    for (const movie of uniqueMovies) {
      const raw = (movie?.media_type ?? 'movie').toString().toLowerCase();
      const label = getMediaTypeLabel(raw);
      const record = counts.get(raw) ?? { label, total: 0 };
      record.total += 1;
      counts.set(raw, record);
    }
    return counts;
  })());

  const mediaTypeFilters = $derived(
    Array.from(mediaTypeCounts.entries()).sort(
      (a, b) => b[1].total - a[1].total || a[1].label.localeCompare(b[1].label)
    )
  );

  const curatedCarouselSections = $derived((() => {
    const sections: { title: string; movies: LibraryMovie[] }[] = [];
    const topRated = sortedByRating.slice(0, 12);
    if (topRated.length > 0) {
      sections.push({ title: 'Top Rated Picks', movies: topRated });
    }
    const freshReleases = releaseSorted
      .filter((movie) => toTimestamp(movie.releaseDate) > 0)
      .slice(0, 12);
    if (freshReleases.length > 0) {
      sections.push({ title: 'Fresh Releases', movies: freshReleases });
    }
    return sections;
  })());

  let searchTerm = $state('');
  let activeMediaType = $state<'all' | string>('all');
  let sortOption = $state<'curated' | 'rating' | 'newest' | 'alpha'>('curated');

  const activeMediaTypeLabel = $derived(
    activeMediaType === 'all'
      ? 'all formats'
      : mediaTypeCounts.get(activeMediaType)?.label ?? getMediaTypeLabel(activeMediaType)
  );

  $effect(() => {
    if (activeMediaType !== 'all' && !mediaTypeCounts.has(activeMediaType)) {
      activeMediaType = 'all';
    }
  });

  const curatedMovies = $derived((() => {
    if (!uniqueMovies.length) return [];
    const query = searchTerm.trim().toLowerCase();

    const filtered = uniqueMovies.filter((movie) => {
      if (activeMediaType !== 'all') {
        const currentType = (movie?.media_type ?? 'movie').toString().toLowerCase();
        if (currentType !== activeMediaType) return false;
      }
      if (query) {
        const haystack = `${movie.title ?? ''} ${movie.overview ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...filtered];

    sorted.sort((a, b) => {
      switch (sortOption) {
        case 'rating': {
          const ratingA = getRatingValue(a) ?? 0;
          const ratingB = getRatingValue(b) ?? 0;
          if (ratingA === ratingB) {
            return toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
          }
          return ratingB - ratingA;
        }
        case 'newest': {
          return toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
        }
        case 'alpha': {
          return (a.title ?? '').localeCompare(b.title ?? '');
        }
        case 'curated':
        default: {
          const ratingA = getRatingValue(a) ?? 0;
          const ratingB = getRatingValue(b) ?? 0;
          const ratingDiff = ratingB - ratingA;
          if (ratingDiff !== 0) return ratingDiff;
          return toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
        }
      }
    });

    return sorted.slice(0, 12);
  })());
</script>

<div class="min-h-screen bg-background">
  <main class="space-y-12 pb-16">
    {#if highlightMovie}
      <section class="space-y-4">
        <Hero movie={highlightMovie} />
      </section>
    {:else}
      <section class="px-[5%] py-24 text-center">
        <h1 class="text-4xl font-bold capitalize text-foreground">{categoryTitle}</h1>
        <p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Discover the best selections tailored for film lovers, binge-watchers, and otaku alike.
        </p>
      </section>
    {/if}

    {#if hasContent}
      <section class="space-y-8 px-[5%]">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              class="w-full pl-9"
              placeholder="Search titles or keywords"
              bind:value={searchTerm}
            />
          </div>

          <Select type="single" bind:value={sortOption}>
            <SelectTrigger
              class="w-full sm:w-48 cursor-pointer"
              aria-label="Sort curated titles"
            >
              <span data-slot="select-value">
                {sortOption === 'curated'
                  ? 'Editor picks'
                  : sortOption === 'rating'
                    ? 'Highest rated'
                    : sortOption === 'newest'
                      ? 'Newest first'
                      : 'A to Z'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="curated">Editor picks</SelectItem>
              <SelectItem value="rating">Highest rated</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="alpha">A to Z</SelectItem>
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            class="rounded-full border-border/60 px-3 py-1 text-[0.7rem] font-semibold flex items-center gap-2"
          >
            <div class="flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Clapperboard class="size-5" />
            </div>
            <span class="font-bold">{numberFormatter.format(totalTitles)}</span>
          </Badge>
        </div>
      </section>


      <section class="space-y-6 px-[5%]">
        <Separator class="bg-border/60" />
        {#if singleGenreMode}
          {#if primaryGenre}
            <CarouselContainer title={primaryGenre.genre} movies={primaryGenre.movies} />
          {:else}
            <p class="text-center text-lg text-muted-foreground">No content found for this category.</p>
          {/if}
        {:else}
          {#each genreData as entry (entry.slug)}
            {#if entry.movies.length > 0}
              <CarouselContainer title={entry.genre} movies={entry.movies} linkTo={`/genre/${entry.slug}`} />
            {/if}
          {/each}
        {/if}
      </section>
    {:else}
      <section class="px-[5%] py-24 text-center">
        <div class="mx-auto max-w-2xl space-y-4">
          <h2 class="text-3xl font-semibold text-foreground">No titles just yet</h2>
          <p class="text-muted-foreground">
            We couldn't find anything for this destination. Try another category or head back home for fresh discoveries.
          </p>
          <div class="flex justify-center">
            <Button href="/" size="lg" class="gap-2">
              <Sparkles class="size-4" />
              Go home
            </Button>
          </div>
        </div>
      </section>
    {/if}
  </main>
</div>


