<script lang="ts">
  import Hero from '$lib/components/Hero.svelte'
  import { TrendingMoviesSlider, MovieScrollContainer } from '$lib/components'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  let { trendingMovies, collections, genres } = $derived(data)
</script>

<div class="bg-bg-color text-text-color min-h-screen">
  <main>
    {#if trendingMovies.length > 0}
      <Hero movie={trendingMovies[0]} />
    {/if}

    <TrendingMoviesSlider title="Trending Now" movies={trendingMovies} />

    {#each collections as collection (collection.id)}
      {#if collection.movies.length > 0}
        <MovieScrollContainer
          title={collection.name}
          movies={collection.movies}
          linkTo={`/collection/${collection.slug}`}
        />
      {/if}
    {/each}

    {#each genres as genre (genre.id)}
      {#if genre.movies.length > 0}
        <MovieScrollContainer
          title={genre.name}
          movies={genre.movies}
          linkTo={`/genre/${genre.slug}`}
        />
      {/if}
    {/each}
  </main>
</div>
