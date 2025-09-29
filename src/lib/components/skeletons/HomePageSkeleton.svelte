<script lang="ts">
	import MovieCard from '$lib/components/MovieCard.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';

	const heroLines = Array.from({ length: 3 });
	const carouselPlaceholders = Array.from({ length: 6 });
	const sectionPlaceholders = Array.from({ length: 3 });
</script>

<div
	class="flex min-h-[calc(100vh-2rem)] flex-col gap-12 overflow-hidden rounded-lg bg-card/80 shadow-xl backdrop-blur"
>
	<section class="relative h-[24rem] w-full overflow-hidden rounded-lg bg-muted">
		<Skeleton class="absolute inset-0 h-full w-full" />
		<div
			class="absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-background/40"
		></div>
		<div class="relative z-10 flex h-full flex-col justify-end gap-4 p-8 text-left">
			<Skeleton class="h-6 w-32 rounded" />
			<Skeleton class="h-14 w-3/4 rounded" />
			{#each heroLines as _, index}
				<Skeleton class="h-4 w-[clamp(12rem,40vw,28rem)] rounded" data-index={index} />
			{/each}
			<div class="mt-2 flex gap-3">
				<Skeleton class="h-11 w-32 rounded-full" />
				<Skeleton class="h-11 w-32 rounded-full" />
			</div>
		</div>
	</section>

	<div class="p-6 sm:p-5 lg:p-5">
		<div class="mb-6 flex w-full items-center justify-center">
			<Skeleton class="h-9 w-52 rounded" />
		</div>

		<div class="px-[5%]">
			<div class="flex gap-4 overflow-hidden">
				{#each carouselPlaceholders as _, index}
					<div class="basis-auto pl-4" data-index={index}>
						<MovieCard movie={null} />
					</div>
				{/each}
			</div>
		</div>

		{#each sectionPlaceholders as _, sectionIndex}
			<div class="mt-10 space-y-4" data-section={sectionIndex}>
				<Skeleton class="h-8 w-64 rounded" />
				<div class="flex gap-4 overflow-hidden">
					{#each carouselPlaceholders as _, itemIndex}
						<div class="basis-auto pl-4" data-item={itemIndex}>
							<MovieCard movie={null} />
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
