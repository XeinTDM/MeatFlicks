<script lang="ts">
	import TrendingMoviesSlider from './TrendingMoviesSlider.svelte';
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let {
		title,
		movies,
		linkTo
	}: {
		title: string;
		movies: LibraryMovie[];
		linkTo?: string;
	} = $props();

	let isTrendingNow = $derived(title === 'Trending Now');
</script>

{#if isTrendingNow}
	<TrendingMoviesSlider {title} {movies} {linkTo} />
{:else}
	<MediaScrollContainer {title} {movies} {linkTo} />
{/if}
