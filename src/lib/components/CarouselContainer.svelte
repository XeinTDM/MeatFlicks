<script lang="ts">
  import TrendingMoviesSlider from './TrendingMoviesSlider.svelte';
  import MovieScrollContainer from './MovieScrollContainer.svelte';

  export let title: string;
  export let movies: any[];
  export let linkTo: string | undefined = undefined;

  $: isTrendingNow = title === "Trending Now";
</script>

{#if isTrendingNow}
  <TrendingMoviesSlider {title} {movies} {linkTo} />
{:else}
  <MovieScrollContainer {title} {movies} {linkTo} />
{/if}
