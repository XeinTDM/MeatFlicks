<script lang="ts">
	import type { PageData } from './$types';
	import { Film, Tv, ArrowRight, Tag } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { fade, fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Explore - MeatFlicks</title>
	<meta name="description" content="Explore movies and TV shows on MeatFlicks" />
</svelte:head>

<div class="container mx-auto px-4 py-8 md:py-12">
	<header class="mb-12" in:fade={{ duration: 600 }}>
		<h1 class="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Explore</h1>
		<p class="mt-4 text-lg text-muted-foreground">
			Discover your next favorite story across our vast library.
		</p>
	</header>

	<Separator class="mb-12" />

	<section class="mb-16">
		<h2 class="mb-6 text-2xl font-semibold tracking-tight">Browse by Category</h2>
		<div class="grid gap-6 md:grid-cols-2">
			{#each data.categories as category, i}
				<a
					href={`/explore/${category.slug}`}
					class="group relative block"
					in:fly={{ y: 20, delay: i * 100, duration: 500 }}
				>
					<Card.Root
						class="relative h-full overflow-hidden transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
					>
						<Card.Content class="flex h-full flex-col p-6">
							<div
								class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110"
							>
								{#if category.slug === 'movies'}
									<Film size={24} />
								{:else}
									<Tv size={24} />
								{/if}
							</div>
							<Card.Header class="p-0">
								<Card.Title class="text-2xl font-bold">{category.title}</Card.Title>
								<Card.Description class="mt-2 text-base text-muted-foreground">
									{category.description}
								</Card.Description>
							</Card.Header>
							<div class="mt-auto pt-6">
								<span
									class={cn(
										buttonVariants({ variant: 'ghost', size: 'sm' }),
										'px-0 font-semibold text-primary group-hover:underline'
									)}
								>
									Explore {category.title}
									<ArrowRight
										size={16}
										class="ml-2 transition-transform group-hover:translate-x-1"
									/>
								</span>
							</div>
						</Card.Content>

						<!-- Decorative background gradient -->
						<div
							class="absolute inset-0 -z-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
						></div>
					</Card.Root>
				</a>
			{/each}
		</div>
	</section>

	<Separator class="mb-12" />

	<section>
		<h2 class="mb-6 text-2xl font-semibold tracking-tight">Popular Genres</h2>
		<div class="flex flex-wrap gap-3">
			{#each data.topGenres as genre, i}
				<a
					href={`/explore/${genre.slug}`}
					class="transition-transform hover:scale-105 active:scale-95"
					in:fade={{ delay: 400 + i * 50, duration: 400 }}
				>
					<Badge
						variant="secondary"
						class="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-primary hover:text-primary-foreground"
					>
						<Tag size={14} />
						{genre.name}
					</Badge>
				</a>
			{/each}
		</div>
	</section>
</div>

<style>
	:global(.container) {
		max-width: 1200px;
	}
</style>
