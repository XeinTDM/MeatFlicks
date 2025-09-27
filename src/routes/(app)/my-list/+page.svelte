<script lang="ts">
  import MovieCard from '$lib/components/MovieCard.svelte';
  import { watchlist } from '$lib/state/stores/watchlistStore';

  const watchlistMovies = $derived($watchlist.watchlist ?? []);
  const error = $derived($watchlist.error);
</script>

{#if error}
  <div class="flex min-h-screen flex-col items-center justify-center bg-bg-color text-text-color">
    <p class="text-red-500">Error: {error}</p>
  </div>
{:else}
  <div class="min-h-screen bg-bg-color text-text-color">
    <main class="container mx-auto p-4">
      <h1 class="my-8 text-center text-4xl font-bold">My Watchlist</h1>
      {#if watchlistMovies.length === 0}
        <p class="text-center text-lg">Your watchlist is empty.</p>
      {:else}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {#each watchlistMovies as movie (movie.id)}
            <MovieCard {movie} />
          {/each}
        </div>
      {/if}
    </main>
  </div>
{/if}
