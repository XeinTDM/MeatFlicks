<script lang="ts">
  import { Play, Check, Plus } from '@lucide/svelte';
  import { watchlist } from '$lib/state/stores/watchlistStore';
  import { Button } from '$lib/components/ui/button';
  import type { LibraryMovie } from '$lib/types/library';

  let { movie }: { movie: LibraryMovie | null } = $props();

  let message = $state<string | null>(null);

  const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);

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
  <section
    class="relative flex h-[90vh] items-end bg-cover bg-top bg-no-repeat px-[5%] pb-[8%]"
    style={`background-image: ${backgroundStyle}`}
  >
    <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/70 to-transparent from-15% via-50%"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-[var(--bg-color)] via-transparent to-transparent from-10% via-70%"></div>
    <div class="relative z-10 max-w-3xl">
      <h1 class="text-biggest mb-4 leading-tight">{movie.title}</h1>
      <p class="text-normal text-text-color mb-8 max-w-[80%] leading-relaxed">
        {movie.overview}
      </p>
      <div class="flex gap-4">
        <Button
          href={`/movie/${movie.id}`}
          size="lg"
          class="gap-2 font-semibold transition-transform duration-300 hover:-translate-y-0.5"
        >
          <Play class="size-4" />
          Play
        </Button>

        <Button
          type="button"
          size="lg"
          variant={isInWatchlist ? 'destructive' : 'secondary'}
          onclick={handleWatchlistToggle}
          class="gap-2 font-semibold transition-transform duration-300"
        >
          {#if isInWatchlist}
            <Check class="size-4" />
            Added to List
          {:else}
            <Plus class="size-4" />
            My List
          {/if}
        </Button>
      </div>

      {#if message}
        <div class="mt-4 text-sm font-medium text-white">{message}</div>
      {/if}
    </div>
  </section>
{/if}
