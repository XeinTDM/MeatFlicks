<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import {
		Carousel,
		CarouselContent,
		CarouselItem,
		CarouselNext,
		CarouselPrevious
	} from '$lib/components/ui/carousel';
	import MovieCard from './MovieCard.svelte';
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

	let moviesCount = $derived(movies?.length ?? 0);
	let hasMultipleMovies = $derived(moviesCount > 1);

	const carouselOpts = { align: 'start' } as const;
</script>

<div class="px-[5%] py-8">
	<div class="mb-6 flex items-center gap-2">
		<h2 class="text-3xl font-semibold text-foreground">{title}</h2>
		{#if linkTo}
			<a
				href={linkTo}
				data-sveltekit-preload-data="hover"
				class="group flex items-center text-foreground transition-colors duration-300 hover:text-primary"
			>
				<span
					class="text-small font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				>
					See All
				</span>
				<ChevronRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
			</a>
		{/if}
	</div>

	<Carousel class="w-full" opts={carouselOpts}>
		<CarouselContent class="pb-4">
			{#each movies as movie (movie.id)}
				<CarouselItem class="basis-auto pl-4">
					<div class="flex justify-center">
						<MovieCard {movie} />
					</div>
				</CarouselItem>
			{/each}
		</CarouselContent>
		{#if hasMultipleMovies}
			<CarouselPrevious class="hidden md:inline-flex" />
			<CarouselNext class="hidden md:inline-flex" />
		{/if}
	</Carousel>
</div>
