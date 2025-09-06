<script lang="ts">
  import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import MovieCard from './MovieCard.svelte';

  export let title: string;
  export let movies: any[]; // Define Movie type properly later
  export let linkTo: string | undefined = undefined;
</script>

<div class="carousel-container bg-bg-color px-[5%] py-8 relative overflow-y-hidden">
  {#if linkTo}
    <a href={linkTo} class="mb-6 flex w-full justify-center items-center group">
      <h2 class="text-3xl font-semibold text-text-color">{title}</h2>
      <div class="flex items-center text-text-color hover:text-primary-color transition-colors duration-300 ml-2">
        <span class="text-sm font-medium w-0 overflow-hidden transition-all duration-300 group-hover:w-auto">
          See All
        </span>
        <FontAwesomeIcon icon={faChevronRight} class="text-base transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </a>
  {:else}
    <div class="mb-6 flex w-full items-center justify-center gap-2">
      <h2 class="text-3xl font-semibold text-text-color">{title}</h2>
    </div>
  {/if}

  <div class="relative">
    <div class="relative overflow-hidden">
      <div class="flex w-full flex-nowrap overflow-x-auto justify-center">
        {#each movies as movie (movie.id)}
          <div class="flex-shrink-0 w-64 px-2">
            <MovieCard {movie} />
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
