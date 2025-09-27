<script lang="ts">
  import { faPlay, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { page } from '$app/stores';
  import { watchlist } from '$lib/state/stores/watchlistStore';

  export let movie: any;

  $: isAuthenticated = !!$page.data.session?.user;
  $: isInWatchlist = $watchlist.isInWatchlist(movie.id);
  let message: string | null = null;

  async function handleWatchlistToggle() {
    if (!isAuthenticated) {
      message = 'Please sign in to manage your watchlist.';
      return;
    }

    try {
      if (isInWatchlist) {
        await $watchlist.removeFromWatchlist(movie.id);
        message = 'Movie removed from watchlist!';
      } else {
        await $watchlist.addToWatchlist(movie.id);
        message = 'Movie added to watchlist!';
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
      message = 'Failed to update watchlist.';
    }
  }

  $: backgroundStyle = movie ? `url(https://image.tmdb.org/t/p/original${movie.backdropPath})` : '';
</script>

{#if movie}
  <section
    class="relative flex h-[90vh] items-end bg-cover bg-top bg-no-repeat px-[5%] pb-[8%]"
    style="background-image: {backgroundStyle}"
  >
    <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/70 to-transparent from-15% via-50% to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-r from-[var(--bg-color)] via-transparent to-transparent from-10% via-70% to-transparent"></div>
    <div class="relative z-10 max-w-3xl">
      <h1 class="text-biggest mb-4 leading-tight">{movie.title}</h1>
      <p class="text-normal text-text-color mb-8 max-w-[80%] leading-relaxed">
        {movie.overview}
      </p>
      <div class="flex gap-4">
        <a
          href={`/movie/${movie.id}`}
          class="btn bg-primary-color text-text-color hover:bg-primary-color-alt inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-transform duration-300 hover:-translate-y-0.5"
        >
          <FontAwesomeIcon icon={faPlay} /> Play
        </a>
        <button
          on:click={handleWatchlistToggle}
          class="btn text-text-color light:bg-black/5 light:text-text-color light:border light:border-border-color light:hover:bg-black/10 inline-flex items-center gap-2 rounded-lg bg-white/15 px-6 py-3 font-semibold transition-transform duration-300 hover:bg-white/25"
        >
          <FontAwesomeIcon icon={isInWatchlist ? faCheck : faPlus} />
          {isInWatchlist ? 'Added to List' : 'My List'}
        </button>
      </div>
      {#if message}
        <div class="mt-4 text-sm font-medium text-white">{message}</div>
      {/if}
    </div>
  </section>
{/if}
