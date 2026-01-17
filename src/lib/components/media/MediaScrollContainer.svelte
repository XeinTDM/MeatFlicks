<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import {
		Carousel,
		CarouselContent,
		CarouselItem,
		CarouselNext,
		CarouselPrevious
	} from '$lib/components/ui/carousel';
	import MediaCard from './MediaCard.svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let {
		title,
		media: items,
		linkTo
	}: {
		title: string;
		media: LibraryMedia[];
		linkTo?: string;
	} = $props();

	let itemsCount = $derived(items?.length ?? 0);
	let hasMultipleItems = $derived(itemsCount > 1);

	const carouselOpts = { align: 'start' } as const;

	function getLinkHref(path?: string): string {
		if (!path) return '/';
		if (path.startsWith('/')) return path;
		return `/${path.replace(/^\/+/, '')}`;
	}
</script>

<div class="px-[10%] py-8">
	<div class="mb-6 flex items-center gap-2">
		<h2 class="text-3xl font-semibold text-foreground">{title}</h2>
		{#if linkTo}
			<a
				rel="external"
				href={getLinkHref(linkTo)}
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
