<script lang="ts">
	import { Clapperboard, Search, Sparkles } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Hero from '$lib/components/Hero.svelte';
	import CarouselContainer from '$lib/components/CarouselContainer.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import type { LibraryMovie } from '$lib/types/library';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const categoryTitle = $derived(data.categoryTitle ?? 'Explore');
	const genreData = $derived(Array.isArray(data.genreData) ? data.genreData : []);
	const hasContent = $derived(Boolean(data.hasContent && genreData.length > 0));
	const singleGenreMode = $derived(Boolean(data.singleGenreMode));
	const primaryGenre = $derived(genreData[0]);

	const numberFormatter = new Intl.NumberFormat('en-US');
	function normalizeId(movie: LibraryMovie): string {
		if (typeof movie.id === 'string' && movie.id) return movie.id;
		if (typeof movie.id === 'number') return `id-${movie.id}`;
		if (typeof movie.tmdbId === 'number') return `tmdb-${movie.tmdbId}`;
		if (typeof movie.tmdbId === 'string') return `tmdb-${movie.tmdbId}`;
		if (typeof movie.imdbId === 'string') return `imdb-${movie.imdbId}`;
		return `title-${movie.title}`;
	}

	function toTimestamp(value: LibraryMovie['releaseDate']): number {
		if (!value) return 0;
		const date = new Date(value as string);
		const time = date.getTime();
		return Number.isFinite(time) ? time : 0;
	}

	function getRatingValue(movie: LibraryMovie | null | undefined): number | null {
		const rating = movie?.rating;
		return typeof rating === 'number' && Number.isFinite(rating) ? rating : null;
	}

	function getMediaTypeLabel(type: string): string {
		const normalized = type.toLowerCase();
		switch (normalized) {
			case 'movie':
				return 'Movies';
			case 'tv':
			case 'tv_show':
			case 'tv-shows':
				return 'TV Shows';
			case 'anime':
				return 'Anime';
			case 'manga':
				return 'Manga';
			case 'ova':
				return 'OVA';
			case 'ona':
				return 'ONA';
			default:
				return normalized.charAt(0).toUpperCase() + normalized.slice(1);
		}
	}

	const uniqueMovies = $derived(
		(() => {
			const lookup = new SvelteMap<string, LibraryMovie>();
			for (const genre of genreData) {
				for (const movie of genre?.movies ?? []) {
					if (!movie) continue;
					const key = normalizeId(movie);
					if (!lookup.has(key)) {
						lookup.set(key, movie);
					}
				}
			}
			return Array.from(lookup.values());
		})()
	);

	const totalTitles = $derived(uniqueMovies.length);

	const sortedByRating = $derived(
		(() => {
			const entries = [...uniqueMovies];
			entries.sort((a, b) => {
				const ratingA = getRatingValue(a) ?? 0;
				const ratingB = getRatingValue(b) ?? 0;
				if (ratingA === ratingB) {
					return toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
				}
				return ratingB - ratingA;
			});
			return entries;
		})()
	);

	const highlightMovie = $derived(
		(() => {
			for (const movie of sortedByRating) {
				if (movie?.backdropPath) {
					return movie;
				}
			}
			return sortedByRating[0] ?? null;
		})()
	);

	let searchTerm = $state('');
	let sortOption = $state<'curated' | 'rating' | 'newest' | 'alpha'>('curated');
</script>

<div class="min-h-screen bg-background">
	<main class="space-y-12 pb-16">
		{#if highlightMovie}
			<section class="space-y-4">
				<Hero movie={highlightMovie} />
			</section>
		{:else}
			<section class="px-[5%] py-24 text-center">
				<h1 class="text-4xl font-bold text-foreground capitalize">{categoryTitle}</h1>
				<p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
					Discover the best selections tailored for film lovers, binge-watchers, and otaku alike.
				</p>
			</section>
		{/if}

		{#if hasContent}
			<section class="space-y-8 px-[5%]">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div class="relative flex-1">
						<Search
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							class="w-full pl-9"
							placeholder="Search titles or keywords"
							bind:value={searchTerm}
						/>
					</div>

					<Select type="single" bind:value={sortOption}>
						<SelectTrigger class="w-full cursor-pointer sm:w-48" aria-label="Sort curated titles">
							<span data-slot="select-value">
								{sortOption === 'curated'
									? 'Editor picks'
									: sortOption === 'rating'
										? 'Highest rated'
										: sortOption === 'newest'
											? 'Newest first'
											: 'A to Z'}
							</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="curated">Editor picks</SelectItem>
							<SelectItem value="rating">Highest rated</SelectItem>
							<SelectItem value="newest">Newest first</SelectItem>
							<SelectItem value="alpha">A to Z</SelectItem>
						</SelectContent>
					</Select>

					<Badge
						variant="outline"
						class="flex items-center gap-2 rounded-full border-border/60 px-3 py-1 text-[0.7rem] font-semibold"
					>
						<div
							class="flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary"
						>
							<Clapperboard class="size-5" />
						</div>
						<span class="font-bold">{numberFormatter.format(totalTitles)}</span>
					</Badge>
				</div>
			</section>

			<section class="space-y-6 px-[5%]">
				<Separator class="bg-border/60" />
				{#if singleGenreMode}
					{#if primaryGenre}
						<CarouselContainer title={primaryGenre.genre} movies={primaryGenre.movies} />
					{:else}
						<p class="text-center text-lg text-muted-foreground">
							No content found for this category.
						</p>
					{/if}
				{:else}
					{#each genreData as entry (entry.slug)}
						{#if entry.movies.length > 0}
							<CarouselContainer
								title={entry.genre}
								movies={entry.movies}
								linkTo={`/genre/${entry.slug}`}
							/>
						{/if}
					{/each}
				{/if}
			</section>
		{:else}
			<section class="px-[5%] py-24 text-center">
				<div class="mx-auto max-w-2xl space-y-4">
					<h2 class="text-3xl font-semibold text-foreground">No titles just yet</h2>
					<p class="text-muted-foreground">
						We couldn't find anything for this destination. Try another category or head back home
						for fresh discoveries.
					</p>
					<div class="flex justify-center">
						<Button href="/" size="lg" class="gap-2">
							<Sparkles class="size-4" />
							Go home
						</Button>
					</div>
				</div>
			</section>
		{/if}
	</main>
</div>
