<script lang="ts">
	import TrendingMediaSlider from './TrendingMediaSlider.svelte';
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
	<TrendingMediaSlider {title} {movies} {linkTo} />
{:else}
	<MediaScrollContainer {title} media={movies} {linkTo} />
{/if}
