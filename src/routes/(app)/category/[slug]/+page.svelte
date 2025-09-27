<script lang="ts">
  import CarouselContainer from '$lib/components/CarouselContainer.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const { categoryTitle, genreData, hasContent, singleGenreMode } = data;
</script>

<div class="min-h-screen">
  <main>
    <h1 class="my-8 text-center text-4xl font-bold capitalize">{categoryTitle}</h1>
    {#if hasContent}
      {#if singleGenreMode}
        <CarouselContainer title={categoryTitle} movies={genreData[0].movies} />
      {:else}
        {#each genreData as data (data.genre)}
          {#if data.movies.length > 0}
            <CarouselContainer
              title={data.genre}
              movies={data.movies}
              linkTo={`/category/${data.genre}`}
            />
          {/if}
        {/each}
      {/if}
    {:else}
      <p class="text-center text-lg text-text-color">No content found for this category.</p>
    {/if}
  </main>
</div>
