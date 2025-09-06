<script lang="ts">
  import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import MovieCard from './MovieCard.svelte';

  export let title: string;
  export let movies: any[];
  export let linkTo: string | undefined = undefined;
</script>

<div class="carousel-container bg-bg-color px-[5%] py-8 relative">
  <div class="mb-6 flex items-center gap-2">
    <h2 class="text-3xl font-semibold text-text-color">{title}</h2>
    {#if linkTo}
      <a
        href={linkTo}
        class="group flex items-center text-text-color hover:text-primary-color transition-colors duration-300"
      >
        <span class="text-small font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          See All
        </span>
        <FontAwesomeIcon icon={faChevronRight} class="text-base transition-transform duration-300 group-hover:translate-x-1" />
      </a>
    {/if}
  </div>

  <div class="scrollbar-thin scrollbar-thumb-primary-color scrollbar-track-bg-color-alt flex w-full flex-nowrap gap-4 overflow-x-auto pb-4">
    {#each movies as movie (movie.id)}
      <div class="flex-shrink-0 h-[400px] w-[300px] px-2">
        <MovieCard {movie} />
      </div>
    {/each}
  </div>
</div>
