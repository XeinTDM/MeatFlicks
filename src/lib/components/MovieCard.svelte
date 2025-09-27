<script lang="ts">
  import { getContext } from 'svelte';
  import { faPlus, faMinus, faStar } from '@fortawesome/free-solid-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { watchlist } from '$lib/state/stores/watchlistStore';
  import { error as errorStore } from '$lib/state/stores/errorStore';

  export let movie: any;

  let session: any = { user: true };

  $: isInWatchlist = $watchlist.isInWatchlist(movie.id);

  const handleWatchlistToggle = async (event: MouseEvent) => {
    event.stopPropagation();
    if (!session?.user) {
      errorStore.set('Please sign in to manage your watchlist.');
      return;
    }

    try {
      if (isInWatchlist) {
        await $watchlist.removeFromWatchlist(movie.id);
      } else {
        await $watchlist.addToWatchlist(movie.id);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
      errorStore.set('Failed to update watchlist. Please try again.');
    }
  };

  $: if ($watchlist.error) {
    errorStore.set($watchlist.error);
  }

  $: releaseYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A';
  $: qualityTag = movie.is4K ? '4K' : movie.isHD ? 'HD' : '';
</script>

<a
  href={`/movie/${movie.id}`}
  class="movie-card bg-bg-color-alt hover:shadow-shadow-color group relative h-72 cursor-pointer overflow-hidden rounded-xl transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 hover:shadow-lg transform-gpu w-48"
  aria-label={`View details for ${movie.title}`}
>
  <div class="relative w-full h-full">
    {#if movie.posterPath}
      <img
        src={movie.posterPath}
        alt={`${movie.title} Poster`}
        class="object-cover transition-opacity duration-400 ease-in-out w-full h-full rounded-xl"
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center rounded-xl bg-gray-800">
        <img src="" alt="" width="96" height="96" class="text-gray-400" />
      </div>
    {/if}
  </div>
  <div class="absolute inset-0 flex flex-col justify-end bg-black/50 p-4 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100">
    <!-- Rating at top-left -->
    <div class="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100">
      <FontAwesomeIcon icon={faStar} class="text-yellow-500" /> {movie.rating?.toFixed(1)}
    </div>
    <!-- Media Type Tag and Watchlist Button at top-right -->
    <div class="absolute top-4 right-4 flex gap-2 opacity-0 transition-all duration-400 ease-in-out group-hover:scale-100 group-hover:opacity-100">
      <span class="bg-black/70 rounded-full px-1.5 py-0.5 text-xs font-semibold text-text-color">
        {movie.media_type === 'tv' ? 'TV Series' : 'Movie'}
      </span>
      
    </div>
    <div class="translate-y-5 transform text-text-color drop-shadow-md transition-transform delay-100 duration-400 ease-in-out group-hover:translate-y-0">
      <h3 class="mb-2 text-lg font-semibold flex items-center justify-between">
        <span>{movie.title}</span>
        {#if session?.user}
          <button
            on:click={handleWatchlistToggle}
            class={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-base backdrop-blur-sm transition-colors duration-300 ${isInWatchlist ? 'bg-red-600 text-text-color hover:bg-red-700' : 'bg-gray-800/70 text-text-color hover:bg-black/80'}`}
          >
            <FontAwesomeIcon icon={isInWatchlist ? faMinus : faPlus} />
          </button>
        {/if}
      </h3>
      <div class="mb-2 flex items-center gap-3 text-sm text-gray-300">
        <span>{releaseYear}</span>
        {#if qualityTag}
          <span class="bg-primary-color rounded px-1.5 py-0.5 text-xs font-semibold text-text-color">
            {qualityTag}
          </span>
        {/if}
      </div>
      <p class="h-10 overflow-hidden text-sm leading-relaxed text-gray-400">
        {movie.overview}
      </p>
    </div>
  </div>
</a>
