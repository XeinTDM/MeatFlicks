<script lang="ts">
	import { Clapperboard, Search, Sparkles, Filter } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import Hero from '$lib/components/home/Hero.svelte';
	import CarouselContainer from '$lib/components/home/CarouselContainer.svelte';
	import MovieCard from '$lib/components/media/MovieCard.svelte';
	import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
	import ActiveFilters from '$lib/components/filters/ActiveFilters.svelte';
	import SortDropdown from '$lib/components/filters/SortDropdown.svelte';
	import Pagination from '$lib/components/pagination/Pagination.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import type { LibraryMovie } from '$lib/types/library';
	import type { PageData } from './$types';
	import type { MovieFilters, SortOptions } from '$lib/types/filters';
	import type { PaginationParams } from '$lib/types/pagination';
	import { combineURLParams, parseAllFromURL } from '$lib/utils/filterUrl';
	import { DEFAULT_PAGE_SIZE } from '$lib/types/pagination';
	import { hasActiveFilters } from '$lib/types/filters';

	let { data } = $props<{ data: PageData }>();

	const categoryTitle = $derived(data.categoryTitle ?? 'Explore');
	const genreData = $derived(Array.isArray(data.genreData) ? data.genreData : []);
	const useFilters = $derived(Boolean(data.useFilters));
	const movies = $derived(Array.isArray(data.movies) ? data.movies : []);
	const pagination = $derived(data.pagination);
	const filters = $derived((data.filters as MovieFilters) || ({} as MovieFilters));
	const sort = $derived(
		(data.sort as SortOptions) || ({ field: 'popularity', order: 'desc' } as SortOptions)
	);
	const availableGenres = $derived(
		Array.isArray(data.availableGenres)
			? data.availableGenres.map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }))
			: []
	);

	const hasContent = $derived(
		useFilters
			? Boolean(data.hasContent && movies.length > 0)
			: Boolean(data.hasContent && genreData.length > 0)
	);
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

	const uniqueMovies = $derived(
		(() => {
			if (useFilters) return movies;
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

	const totalTitles = $derived(useFilters ? (pagination?.totalItems ?? 0) : uniqueMovies.length);

	const sortedByRating = $derived(
		(() => {
			if (useFilters) return movies;
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
			if (useFilters) return null;
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
	let currentFilters = $state<MovieFilters>({} as MovieFilters);
	let currentSort = $state<SortOptions>({ field: 'popularity', order: 'desc' } as SortOptions);
	let currentPagination = $state<PaginationParams>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

	$effect(() => {
		currentFilters = filters;
		currentSort = sort;
		if (pagination) {
			const page = 'currentPage' in pagination ? pagination.currentPage : pagination.page;
			currentPagination = { page, pageSize: pagination.pageSize };
		}
	});

	function updateURL() {
		const params = combineURLParams(currentFilters, currentSort, currentPagination);
		const url = new URL(window.location.href);
		url.search = params.toString();
		goto(url.pathname + url.search, { keepFocus: true, noScroll: true });
	}

	function handleFiltersChange(newFilters: MovieFilters) {
		currentFilters = newFilters;
		currentPagination = { ...currentPagination, page: 1 };
		updateURL();
	}

	function handleClearFilters() {
		currentFilters = {} as MovieFilters;
		currentPagination = { ...currentPagination, page: 1 };
		updateURL();
	}

	function handleSortChange(newSort: SortOptions) {
		currentSort = newSort;
		updateURL();
	}

	function handlePageChange(page: number) {
		currentPagination = { ...currentPagination, page };
		updateURL();
	}

	function handleRemoveFilter(filterKey: keyof MovieFilters) {
		const newFilters = { ...currentFilters };
		if (filterKey === 'yearFrom' || filterKey === 'yearTo') {
			delete newFilters.yearFrom;
			delete newFilters.yearTo;
		} else if (filterKey === 'minRating' || filterKey === 'maxRating') {
			delete newFilters.minRating;
			delete newFilters.maxRating;
		} else if (filterKey === 'runtimeMin' || filterKey === 'runtimeMax') {
			delete newFilters.runtimeMin;
			delete newFilters.runtimeMax;
		} else {
			delete newFilters[filterKey];
		}
		handleFiltersChange(newFilters);
	}
</script>

<div class="min-h-screen bg-background">
	<main class="space-y-12 pb-16">
		{#if highlightMovie && !useFilters}
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
			{#if useFilters}
				<!-- Filter-based UI -->
				<section class="space-y-6 px-[5%]">
					<div class="flex flex-col gap-4 lg:flex-row">
						<!-- Filter Sidebar -->
						<aside class="w-full lg:w-64 lg:shrink-0">
							<FilterPanel
								filters={currentFilters}
								{availableGenres}
								onFiltersChange={handleFiltersChange}
								onClearAll={handleClearFilters}
							/>
						</aside>

						<!-- Main Content -->
						<div class="flex-1 space-y-6">
							<!-- Active Filters & Sort -->
							<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div class="flex-1">
									{#if hasActiveFilters(currentFilters)}
										<ActiveFilters
											filters={currentFilters}
											onRemoveFilter={handleRemoveFilter}
											onClearAll={handleClearFilters}
										/>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<SortDropdown sort={currentSort} onSortChange={handleSortChange} />
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
							</div>

							<!-- Movies Grid -->
							{#if movies.length > 0}
								<div
									class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
								>
									{#each movies as movie (normalizeId(movie))}
										<MovieCard {movie} />
									{/each}
								</div>

								<!-- Pagination -->
								{#if pagination && pagination.totalPages > 1}
									<div class="flex justify-center pt-6">
										<Pagination {pagination} onPageChange={handlePageChange} />
									</div>
								{/if}
							{:else}
								<div class="py-24 text-center">
									<div class="mx-auto max-w-md space-y-4">
										<Filter class="mx-auto size-12 text-muted-foreground" />
										<h2 class="text-2xl font-semibold text-foreground">No results found</h2>
										<p class="text-muted-foreground">
											Try adjusting your filters or clearing them to see more content.
										</p>
										{#if hasActiveFilters(currentFilters)}
											<Button onclick={handleClearFilters} variant="outline">
												Clear all filters
											</Button>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</section>
			{:else}
				<!-- Legacy Genre-based UI -->
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
			{/if}
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
