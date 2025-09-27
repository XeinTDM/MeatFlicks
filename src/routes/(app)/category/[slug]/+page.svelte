<script lang="ts">
  import CarouselContainer from '$lib/components/CarouselContainer.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const { categoryTitle, genreData, hasContent, singleGenreMode } = data;
  const primaryGenre = genreData[0];
</script>

<div class="min-h-screen">
  <main>
    <h1 class="my-8 text-center text-4xl font-bold capitalize">{categoryTitle}</h1>
    {#if hasContent}
      {#if singleGenreMode}
        {#if primaryGenre}
          <CarouselContainer title={categoryTitle} movies={primaryGenre.movies} />
        {:else}
          <p class="text-center text-lg text-text-color">No content found for this category.</p>
        {/if}
      {:else}
        {#each genreData as entry (entry.slug)}
          {#if entry.movies.length > 0}
            <CarouselContainer
              title={entry.genre}
              movies={entry.movies}
              linkTo={`/genre/${entry.slug}`}
            />
          {/if}
        {/each}
      {/if}
    {:else}
      <p class="text-center text-lg text-text-color">No content found for this category.</p>
    {/if}
  </main>
</div>
