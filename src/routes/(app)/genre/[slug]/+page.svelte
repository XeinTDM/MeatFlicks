<script lang="ts">
  import CarouselContainer from '$lib/components/CarouselContainer.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const { genreTitle, movies, hasContent } = data;
</script>

<div class="min-h-screen">
  <main>
    <h1 class="my-8 text-center text-4xl font-bold capitalize">{genreTitle}</h1>
    {#if hasContent}
      <CarouselContainer title={genreTitle} movies={movies} />
    {:else}
      <p class="text-center text-lg text-foreground">No content found for this genre.</p>
    {/if}
  </main>
</div>

