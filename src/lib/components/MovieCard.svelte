<script lang="ts">
  import { Plus, Minus, Star } from '@lucide/svelte';
  import { watchlist } from '$lib/state/stores/watchlistStore';
  import type { Movie as WatchlistMovie } from '$lib/state/stores/watchlistStore';
  import { error as errorStore } from '$lib/state/stores/errorStore';

  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardHeader,
    CardContent,
    CardTitle
  } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import type { LibraryMovie } from '$lib/types/library';

  let { movie }: { movie: LibraryMovie | WatchlistMovie | null } = $props();

  const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);

  function handleWatchlistToggle(event: MouseEvent) {
    event.stopPropagation();

    if (!movie) {
      errorStore.set('No movie selected.');
      return;
    }

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

  $effect(() => {
    if ($watchlist?.error) {
      errorStore.set($watchlist.error);
    }
  });

  const releaseYear = $derived(
    movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A'
  );

  const qualityTag = $derived(
    movie?.is4K ? '4K' : movie?.isHD ? 'HD' : ''
  );

  const detailsHref = $derived(
    movie
      ? movie.canonicalPath ??
        (movie.imdbId
          ? `/movie/${movie.imdbId}`
          : movie.tmdbId
            ? `/movie/${movie.tmdbId}`
            : `/movie/${movie.id}`)
      : undefined
  );
</script>

<a
  href={detailsHref}
  aria-label={movie ? `View details for ${movie.title}` : 'Loading movie'}
  class="group relative h-72 w-48 cursor-pointer overflow-hidden rounded-xl transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 hover:shadow-lg"
>
  <Card class="h-full w-full overflow-hidden bg-background p-0 gap-0">
    <div class="relative h-full w-full flex-1">
      {#if movie?.posterPath}
        <img
          src={movie.posterPath}
          alt={`${movie.title} Poster`}
          class="h-full w-full object-cover transition-opacity duration-400 ease-in-out"
        />
      {:else if movie}
        <div class="flex h-full w-full flex-1 items-center justify-center bg-muted">
          <img src="" alt="" width="96" height="96" class="text-muted-foreground" />
        </div>
      {:else}
        <Skeleton class="h-full w-full" />
      {/if}
    </div>

    {#if movie}
      <div class="absolute inset-0 flex flex-col justify-end bg-black/50 p-4 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100">
        <div class="absolute top-4 left-4 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100">
          <Badge
            variant="secondary"
            class="flex items-center gap-1 bg-black/70 text-white"
          >
            <Star class="size-4 text-yellow-500" fill="currentColor" stroke="currentColor" />
            {movie.rating?.toFixed(1)}
          </Badge>
        </div>

        <div class="absolute top-4 right-4 flex gap-2 opacity-0 transition-all duration-400 ease-in-out group-hover:scale-100 group-hover:opacity-100">
          <Badge
            variant="secondary"
            class="bg-black/70 text-white"
          >
            {movie.media_type === 'tv' ? 'TV Series' : 'Movie'}
          </Badge>
        </div>

        <CardHeader class="translate-y-5 transform transition-transform delay-100 duration-400 ease-in-out group-hover:translate-y-0">
          <CardTitle class="flex items-center justify-between text-lg font-semibold text-foreground">
            <span>{movie.title}</span>
            <Button
              type="button"
              size="icon"
              variant={isInWatchlist ? 'destructive' : 'secondary'}
              onclick={handleWatchlistToggle}
              class="size-8 rounded-full border border-border backdrop-blur-sm"
            >
              {#if isInWatchlist}
                <Minus class="size-4" />
              {:else}
                <Plus class="size-4" />
              {/if}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent class="text-sm text-muted-foreground">
          <div class=" flex items-center gap-3">
            <span>{releaseYear}</span>
            {#if qualityTag}
              <Badge
                variant="secondary"
                class="bg-background text-foreground"
              >
                {qualityTag}
              </Badge>
            {/if}
          </div>
          <p class="h-10 overflow-hidden text-sm leading-relaxed text-muted-foreground">
            {movie.overview}
          </p>
        </CardContent>
      </div>
    {:else}
      <div class="absolute inset-0 flex flex-col justify-end p-4">
        <Skeleton class="mb-2 h-4 w-3/4 rounded" />
        <Skeleton class="mb-2 h-3 w-1/2 rounded" />
        <Skeleton class="h-10 w-full rounded" />
      </div>
    {/if}
  </Card>
</a>
