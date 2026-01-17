<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import {
		Carousel,
		CarouselContent,
		CarouselItem,
		CarouselNext,
		CarouselPrevious
	} from '$lib/components/ui/carousel';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let {
		title,
		movies: items,
		linkTo
	}: {
		title: string;
		movies: LibraryMedia[];
		linkTo?: string;
	} = $props();

	let itemsCount = $derived(items?.length ?? 0);
	let hasMultipleItems = $derived(itemsCount > 1);

	const carouselOpts = { align: 'start' } as const;

	function getResolvedPath(path: string | undefined): string {
		if (!path) return '/#';
		return path.startsWith('/') ? path : `/${path}`;
	}
</script>

<div class="px-[10%] py-8">
	{#if linkTo}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			rel="external"
			href={getResolvedPath(linkTo)}
			data-sveltekit-preload-data="hover"
			class="group mb-6 flex w-full items-center justify-start text-foreground transition-colors duration-300 hover:text-primary"
		>
			<h2 class="text-3xl font-semibold">{title}</h2>
			<div class="ml-2 flex items-center gap-1">
				<span
					class="w-0 overflow-hidden text-sm font-medium transition-all duration-300 group-hover:w-auto"
				>
					See All
				</span>
				<ChevronRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
			</div>
		</a>
	{:else}
		<div class="mb-6 flex w-full items-center justify-start">
			<h2 class="text-3xl font-semibold text-foreground">{title}</h2>
		</div>
	{/if}

	<Carousel class="relative w-full" opts={carouselOpts}>
		<CarouselContent class="pb-4">
			{#each items as item (item.id)}
				<CarouselItem class="basis-auto pl-4">
					<div class="flex justify-center">
						<MediaCard movie={item} />
					</div>
				</CarouselItem>
			{/each}
		</CarouselContent>
		{#if hasMultipleItems}
			<CarouselPrevious class="hidden md:inline-flex" />
			<CarouselNext class="hidden md:inline-flex" />
		{/if}
	</Carousel>
</div>