<script lang="ts">
  import MovieCard from '$lib/components/MovieCard.svelte'
  import { onDestroy } from 'svelte'

  import { Input } from '$lib/components/ui/input'
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
  import type { LibraryMovie } from '$lib/types/library'

  let query = $state('')
  let movies = $state<LibraryMovie[]>([])
  let loading = $state(false)
  let error = $state<string | null>(null)
  let debounceTimeout = $state<ReturnType<typeof setTimeout> | null>(null)
  let controller = $state<AbortController | null>(null)

  async function handleSearch() {
    const trimmed = query.trim()

    if (!trimmed) {
      movies = []
      error = null
      loading = false
      return
    }

    controller?.abort()
    controller = new AbortController()

    loading = true
    error = null

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal
      })
      if (!res.ok) throw new Error("Failed to fetch search results")

      const data: LibraryMovie[] = await res.json()
      movies = data
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      error = err instanceof Error ? err.message : 'Unable to fetch search results.'
    } finally {
      loading = false
    }
  }

  $effect(() => {
    clearTimeout(debounceTimeout ?? undefined)
    if (query) {
      debounceTimeout = setTimeout(() => {
        handleSearch()
      }, 400)
    }
  })

  onDestroy(() => {
    clearTimeout(debounceTimeout ?? undefined)
    controller?.abort()
  })
</script>

<div class="min-h-screen">
  <main class="container mx-auto p-4">
    <h1 class="my-8 text-center text-4xl font-bold">Search Movies</h1>
    <div class="mb-8 flex justify-center">
      <Input
        type="text"
        placeholder="Search by title..."
        class="max-w-md h-11 text-base bg-card text-foreground"
        aria-label="Search movies by title"
        bind:value={query}
      />
    </div>

    {#if loading}
      <Alert class="mx-auto mb-6 max-w-md">
        <AlertDescription>Loading results...</AlertDescription>
      </Alert>
    {:else if error}
      <Alert variant="destructive" class="mx-auto mb-6 max-w-md">
        <AlertTitle>Search Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    {:else if movies.length === 0 && query.trim()}
      <Alert class="mx-auto mb-6 max-w-md">
        <AlertDescription>No movies found for "{query}".</AlertDescription>
      </Alert>
    {/if}

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {#each movies as movie (movie.id)}
        <MovieCard {movie} />
      {/each}
    </div>
  </main>
</div>


