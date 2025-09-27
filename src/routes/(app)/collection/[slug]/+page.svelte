<script lang="ts">
  import CarouselContainer from '$lib/components/CarouselContainer.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const { collectionTitle, movies, hasContent } = data;
</script>

<div class="min-h-screen">
  <main>
    <h1 class="my-8 text-center text-4xl font-bold capitalize">{collectionTitle}</h1>
    {#if hasContent}
      <CarouselContainer title={collectionTitle} movies={movies} />
    {:else}
      <p class="text-center text-lg text-text-color">No content found for this collection.</p>
    {/if}
  </main>
</div>
