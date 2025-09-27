<script lang="ts">
  import MovieCard from '$lib/components/MovieCard.svelte';
  import { onDestroy } from 'svelte';

  let query = '';
  let movies: any[] = [];
  let loading = false;
  let error: string | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout>;
  let controller: AbortController | null = null;

  async function handleSearch() {
    const trimmed = query.trim();

    if (!trimmed) {
      movies = [];
      error = null;
      loading = false;
      return;
    }

    controller?.abort();
    controller = new AbortController();

    loading = true;
    error = null;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data: any[] = await res.json();
      movies = data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      error = err.message ?? 'Unable to fetch search results.';
    } finally {
      loading = false;
    }
  }

  $: {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      handleSearch();
    }, query ? 400 : 0);
  }

  onDestroy(() => {
    clearTimeout(debounceTimeout);
    controller?.abort();
  });
</script>

<div class="min-h-screen">
  <main class="container mx-auto p-4">
    <h1 class="my-8 text-center text-4xl font-bold">Search Movies</h1>
    <div class="mb-8 flex justify-center">
      <input
        type="text"
        placeholder="Search by title..."
        class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-3 text-text-color focus:border-blue-500 focus:outline-none"
        bind:value={query}
      />
    </div>

    {#if loading}
      <p class="text-center">Loading...</p>
    {:else if error}
      <p class="text-center text-red-500">Error: {error}</p>
    {:else if movies.length === 0 && query.trim()}
      <p class="text-center">No movies found for &quot;{query}&quot;.</p>
    {/if}

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each movies as movie (movie.id)}
        <MovieCard {movie} />
      {/each}
    </div>
  </main>
</div>
