<script lang="ts">
  import { browser } from '$app/environment'
  import MovieCard from '$lib/components/MovieCard.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
  import { Badge } from '$lib/components/ui/badge'
  import { Switch } from '$lib/components/ui/switch'
  import { Label } from '$lib/components/ui/label'
  import type { LibraryMovie } from '$lib/types/library'
  import {
    Search as SearchIcon,
    LoaderCircle,
    Sparkles as SparklesIcon,
    History as HistoryIcon,
    SlidersHorizontal,
    RotateCcw,
    Clapperboard,
    Tv,
    Flame
  } from '@lucide/svelte'
  import { onDestroy, onMount } from 'svelte'

  const trendingQueries = [
    'Deadpool & Wolverine',
    'House of the Dragon',
    'The Boys',
    'John Wick',
    'Attack on Titan',
    'Bridgerton'
  ]

  const sortOptions = [
    { label: 'Best Match', value: 'relevance' as const },
    { label: 'Top Rated', value: 'rating' as const },
    { label: 'Newest', value: 'newest' as const }
  ]

  const qualityOptions = [
    { label: 'Any Quality', value: 'any' as const },
    { label: 'HD & up', value: 'hd' as const },
    { label: '4K only', value: '4k' as const }
  ]

  const curatedCollections = [
    {
      title: 'Fresh Releases',
      description: 'Catch the newest episodes and theatrical drops hitting streaming first.',
      query: '2024',
      icon: Clapperboard
    },
    {
      title: 'Binge-Worthy TV',
      description: 'Fan-favorite series you can watch free from pilot to finale.',
      query: 'season',
      icon: Tv
    },
    {
      title: 'Anime Spotlight',
      description: 'New arcs and classic sagas with sub & dub options.',
      query: 'anime',
      icon: Flame
    }
  ]

  const historyStorageKey = 'meatflicks:search-history'
  const skeletonSlots = Array.from({ length: 12 })
  const overviewSwitchId = 'search-overview-toggle'

  let query = $state('')
  let movies = $state<LibraryMovie[]>([])
  let loading = $state(false)
  let error = $state<string | null>(null)
  let debounceTimeout = $state<ReturnType<typeof setTimeout> | null>(null)
  let controller = $state<AbortController | null>(null)
  let searchHistory = $state<string[]>([])
  let sortBy = $state<'relevance' | 'rating' | 'newest'>('relevance')
  let qualityFilter = $state<'any' | 'hd' | '4k'>('any')
  let onlyWithOverview = $state(false)
  let lastSearchedTerm = $state('')

  onMount(() => {
    if (!browser) return
    const stored = localStorage.getItem(historyStorageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          searchHistory = parsed
            .filter((value): value is string => typeof value === 'string')
            .slice(0, 8)
        }
      } catch {
        // ignore malformed history
      }
    }
  })

  function persistHistory(items: string[]) {
    if (!browser) return
    localStorage.setItem(historyStorageKey, JSON.stringify(items))
  }

  function updateHistory(term: string) {
    const normalized = term.trim()
    if (!normalized) return
    const lowered = normalized.toLowerCase()
    const next = [
      normalized,
      ...searchHistory.filter((item) => item.toLowerCase() !== lowered)
    ].slice(0, 8)
    searchHistory = next
    persistHistory(next)
  }

  function clearHistory() {
    searchHistory = []
    persistHistory([])
  }

  async function performSearch(rawTerm: string) {
    const trimmed = rawTerm.trim()
    if (!trimmed) {
      movies = []
      error = null
      loading = false
      lastSearchedTerm = ''
      return
    }

    controller?.abort()
    controller = new AbortController()

    loading = true
    error = null
    lastSearchedTerm = trimmed

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal
      })

      if (!res.ok) throw new Error('Failed to fetch search results')

      const data: LibraryMovie[] = await res.json()
      movies = data
      updateHistory(trimmed)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      error = err instanceof Error ? err.message : 'Unable to fetch search results.'
    } finally {
      loading = false
    }
  }

  function scheduleSearch(term: string) {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }

    if (!term.trim()) {
      movies = []
      error = null
      loading = false
      lastSearchedTerm = ''
      return
    }

    debounceTimeout = setTimeout(() => {
      void performSearch(term)
    }, 350)
  }

  $effect(() => {
    scheduleSearch(query)
  })

  function handleSubmit(event: Event) {
    event.preventDefault()
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }
    void performSearch(query)
  }

  function handleQuickSearch(term: string) {
    query = term
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }
    void performSearch(term)
  }

  function resetFilters() {
    sortBy = 'relevance'
    qualityFilter = 'any'
    onlyWithOverview = false
  }

  onDestroy(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }
    controller?.abort()
  })

  const filteredMovies = $derived(() => {
    let result = [...movies]

    if (qualityFilter === '4k') {
      result = result.filter((movie) => movie.is4K)
    } else if (qualityFilter === 'hd') {
      result = result.filter((movie) => movie.is4K || movie.isHD)
    }

    if (onlyWithOverview) {
      result = result.filter((movie) => Boolean(movie.overview?.trim()))
    }

    if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    } else if (sortBy === 'newest') {
      const toTimestamp = (value: LibraryMovie['releaseDate']) => {
        if (!value) return 0
        const date = typeof value === 'string' ? new Date(value) : value
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
      }

      result.sort((a, b) => toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate))
    }

    return result
  })

  const hasActiveFilters = $derived(
    () => qualityFilter !== 'any' || onlyWithOverview || sortBy !== 'relevance'
  )

  const resultsSummary = $derived(() => {
    if (!lastSearchedTerm) return ''
    if (error) return ''

    const total = movies.length
    const visible = filteredMovies.length

    if (total === 0) {
      return `No matches for "${lastSearchedTerm}".`
    }

    if (hasActiveFilters && visible !== total) {
      return `Showing ${visible} of ${total} matches for "${lastSearchedTerm}" after filters.`
    }

    return `Showing ${visible} match${visible === 1 ? '' : 'es'} for "${lastSearchedTerm}".`
  })
</script>

<div class="min-h-screen">
  <main class="container mx-auto px-2 py-2 md:py-2">
    <section class="space-y-10 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-sm sm:p-8">
      <header class="space-y-6">
        <div class="space-y-3">
          <span class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <SparklesIcon class="size-4" />
            Instant streaming search
          </span>
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Find something to watch right now
          </h1>
          <p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Search every movie, series, and anime available on MeatFlicks. Filter by quality, jump back into recent searches, and start streaming in seconds.
          </p>
        </div>

        <form class="flex flex-col gap-3 md:flex-row" onsubmit={handleSubmit}>
          <div class="relative flex-1">
            <SearchIcon class="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search titles, people, or keywords..."
              class="h-12 w-full rounded-2xl border border-border/60 bg-background/60 pl-12 text-base shadow-sm focus-visible:border-primary focus-visible:ring-primary/40"
              bind:value={query}
              aria-label="Search the MeatFlicks library"
            />
          </div>
          <Button type="submit" class="h-12 min-w-[120px] rounded-2xl text-base font-semibold">
            {#if loading}
              <LoaderCircle class="mr-2 size-4 animate-spin" />
            {/if}
            Search
          </Button>
        </form>

        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">Trending now:</span>
          {#each trendingQueries as item}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="h-8 rounded-full border border-border/60 bg-background/70 px-3 text-xs font-medium hover:bg-background"
              onclick={() => handleQuickSearch(item)}
            >
              {item}
            </Button>
          {/each}
        </div>

        {#if searchHistory.length > 0}
          <div class="space-y-2 rounded-2xl border border-border/40 bg-background/50 p-4">
            <div class="flex items-center justify-between text-sm font-medium text-foreground">
              <span class="flex items-center gap-2">
                <HistoryIcon class="size-4 text-muted-foreground" />
                Recent searches
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                onclick={clearHistory}
              >
                Clear
              </Button>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each searchHistory as term}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-8 rounded-full border border-transparent bg-background/80 px-3 text-xs font-medium text-foreground hover:border-border/40 hover:bg-background"
                  onclick={() => handleQuickSearch(term)}
                >
                  {term}
                </Button>
              {/each}
            </div>
          </div>
        {/if}
      </header>

      <section class="space-y-5 rounded-2xl border border-border/50 bg-background/60 p-5 shadow-inner">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span class="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal class="size-4 text-muted-foreground" />
            Refine results
          </span>
          {#if hasActiveFilters}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 gap-1 self-start rounded-full px-3 text-xs text-muted-foreground hover:text-foreground md:self-auto"
              onclick={resetFilters}
            >
              <RotateCcw class="size-3.5" />
              Reset filters
            </Button>
          {/if}
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</p>
            <div class="flex flex-wrap gap-2">
              {#each sortOptions as option}
                <Button
                  type="button"
                  size="sm"
                  variant={sortBy === option.value ? 'default' : 'outline'}
                  class="h-8 rounded-full px-3 text-xs font-semibold"
                  onclick={() => (sortBy = option.value)}
                >
                  {option.label}
                </Button>
              {/each}
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quality</p>
            <div class="flex flex-wrap gap-2">
              {#each qualityOptions as option}
                <Button
                  type="button"
                  size="sm"
                  variant={qualityFilter === option.value ? 'default' : 'outline'}
                  class="h-8 rounded-full px-3 text-xs font-semibold"
                  onclick={() => (qualityFilter = option.value)}
                >
                  {option.label}
                </Button>
              {/each}
            </div>
          </div>

          <div class="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 p-3">
            <Switch
              id={overviewSwitchId}
              bind:checked={onlyWithOverview}
              aria-describedby={`${overviewSwitchId}-description`}
            />
            <div>
              <Label for={overviewSwitchId} class="cursor-pointer text-sm font-semibold text-foreground">
                Storyline only
              </Label>
              <p id={`${overviewSwitchId}-description`} class="text-xs text-muted-foreground">
                Hide titles without a synopsis so you can decide faster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {#if resultsSummary}
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm">
          <div class="flex flex-wrap items-center gap-3">
            <Badge class="rounded-full border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary" variant="outline">
              {lastSearchedTerm}
            </Badge>
            <span class="text-muted-foreground">{resultsSummary}</span>
          </div>
          {#if movies.length > 0}
            <span class="text-xs uppercase tracking-wide text-muted-foreground">
              {filteredMovies.length} visible / {movies.length} total
            </span>
          {/if}
        </div>
      {/if}

      {#if error}
        <Alert variant="destructive" class="border-destructive/40 bg-destructive/10">
          <AlertTitle>Search error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      {/if}

      {#if filteredMovies.length > 0}
        <div class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {#each filteredMovies as movie (movie.id)}
            <MovieCard {movie} />
          {/each}
        </div>
      {:else if loading}
        <div class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {#each skeletonSlots as _, index}
            <MovieCard movie={null} />
          {/each}
        </div>
      {:else}
        <div class="space-y-4">
          {#if lastSearchedTerm && !error}
            <Alert class="border-border/60 bg-background/60">
              <AlertTitle>No matches found</AlertTitle>
              <AlertDescription>
                {hasActiveFilters
                  ? 'Nothing matched after filters. Try resetting filters or searching for a different title.'
                  : 'We could not find that title. Try a different keyword or explore the suggestions below.'}
              </AlertDescription>
            </Alert>
          {/if}

          <section class="space-y-4 rounded-2xl border border-border/40 bg-background/60 p-6">
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-foreground">
                {lastSearchedTerm ? 'Try one of these popular hubs' : 'Jump back in'}
              </h2>
              <p class="text-sm text-muted-foreground">
                {lastSearchedTerm
                  ? 'These fan favorites are streaming free right now - tap a hub to keep exploring.'
                  : 'Explore curated collections to spark your next watch - or start typing to run a custom search.'}
              </p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {#each curatedCollections as collection (collection.title)}
                <button
                  type="button"
                  class="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  onclick={() => handleQuickSearch(collection.query)}
                >
                  <span class="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <collection.icon class="size-5" />
                  </span>
                  <div class="space-y-1">
                    <h3 class="text-lg font-semibold text-foreground">{collection.title}</h3>
                    <p class="text-sm text-muted-foreground">{collection.description}</p>
                  </div>
                  <span class="text-xs font-semibold text-primary">Search "{collection.query}" -></span>
                </button>
              {/each}
            </div>
          </section>
        </div>
      {/if}
    </section>
  </main>
</div>



