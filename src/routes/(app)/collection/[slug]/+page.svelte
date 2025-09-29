<script lang="ts">
	import CarouselContainer from '$lib/components/CarouselContainer.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const collectionTitle = $derived(data.collectionTitle);
	const movies = $derived(data.movies);
	const hasContent = $derived(data.hasContent);
</script>

<div class="min-h-screen">
	<main>
		<h1 class="my-8 text-center text-4xl font-bold capitalize">{collectionTitle}</h1>
		{#if hasContent}
			<CarouselContainer title={collectionTitle} {movies} />
		{:else}
			<p class="text-center text-lg text-foreground">No content found for this collection.</p>
		{/if}
	</main>
</div>
