<script lang="ts">
  import { Play, Check, Plus, CalendarDays, Star } from '@lucide/svelte';
  import { watchlist } from '$lib/state/stores/watchlistStore';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import type { LibraryMovie } from '$lib/types/library';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

  let { movie }: { movie: LibraryMovie | null } = $props();

  let message = $state<string | null>(null);

  const watchlistEntries = $derived($watchlist.watchlist);
  const isInWatchlist = $derived(
    movie ? watchlistEntries.some((entry) => entry.id === String(movie.id)) : false
  );

  const mediaTypeLabel = $derived(() =>
    movie?.media_type === 'tv' ? 'TV Series' : 'Movie'
  );

  const releaseDateLabel = $derived(() => {
    if (!movie?.releaseDate) {
      return 'Unknown release';
    }

    const releaseDate = new Date(movie.releaseDate);

    if (Number.isNaN(releaseDate.getTime())) {
      return String(movie.releaseDate);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(releaseDate);
  });

  const ratingLabel = $derived(() => {
    const rating = typeof movie?.rating === 'number' ? movie.rating : null;
    return rating && rating > 0 ? rating.toFixed(1) : 'NR';
  });

  const detailsHref = $derived(
    movie
      ? movie.canonicalPath ??
        (movie.imdbId
          ? `/movie/${movie.imdbId}`
          : movie.tmdbId
            ? `/movie/${movie.tmdbId}`
            : `/movie/${movie.id}`)
      : '#'
  );

  function handleWatchlistToggle() {
    if (!movie) {
      message = 'No movie selected.';
      return;
    }

    try {
      if (isInWatchlist) {
        watchlist.removeFromWatchlist(movie.id);
        message = 'Removed from watchlist.';
      } else {
        watchlist.addToWatchlist(movie);
        message = 'Added to watchlist!';
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
      message = 'Failed to update watchlist.';
    }
  }

  $effect(() => {
    if ($watchlist?.error) {
      message = $watchlist.error;
    }
  });

  const backgroundStyle = $derived(
    movie ? `url(https://image.tmdb.org/t/p/original${movie.backdropPath})` : ''
  );
</script>

{#if movie}
  <Card
    class="relative min-h-[60vh] overflow-hidden border-0 bg-transparent bg-cover bg-center bg-no-repeat p-0 md:min-h-[65vh] lg:min-h-[70vh]"
    style={`background-image: ${backgroundStyle}`}
  >
    <div class="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent"></div>

    <div class="relative z-10 flex h-full items-end px-[5%] py-12">
      <CardContent class="max-w-2xl space-y-6 px-0 text-foreground">
        <CardHeader class="space-y-4 px-0">
          <CardTitle class="text-4xl font-bold leading-tight sm:text-5xl">
            {movie.title}
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
          {movie.overview}
        </p>

        <div class="flex items-center gap-4">
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
            class="size-11 rounded-full border border-foreground/20 bg-background/40 text-foreground backdrop-blur transition-transform duration-300 hover:-translate-y-0.5"
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
  </Card>
{/if}
