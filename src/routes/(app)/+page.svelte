<script lang="ts">
  import Hero from '$lib/components/Hero.svelte'
  import { TrendingMoviesSlider, MovieScrollContainer } from '$lib/components'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  let { trendingMovies, collections, genres } = $derived(data)
</script>

<div class="text-foreground min-h-screen">
  <div class="mx-auto w-full pl-0 pr-2 py-2 sm:pl-0 sm:pr-2 lg:pl-0 lg:pr-2">
    <main class="flex min-h-[calc(100vh-2rem)] flex-col gap-12 overflow-hidden rounded-lg bg-card/80 shadow-xl backdrop-blur">
      {#if trendingMovies.length > 0}
        <Hero movie={trendingMovies[0]} />
      {/if}

      <div class="p-6 sm:p-5 lg:p-5">
        <TrendingMoviesSlider title="Trending Now" movies={trendingMovies} />

        {#each collections as collection (collection.id)}
          {#if collection.movies.length > 0}
            <MovieScrollContainer
              title={collection.name}
              movies={collection.movies}
              linkTo={`/collection/${collection.slug}`}/>
          {/if}
        {/each}

        {#each genres as genre (genre.id)}
          {#if genre.movies.length > 0}
            <MovieScrollContainer
              title={genre.name}
              movies={genre.movies}
              linkTo={`/genre/${genre.slug}`}/>
          {/if}
        {/each}
      </div>
    </main>
  </div>
</div>
