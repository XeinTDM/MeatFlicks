<script lang="ts">
	import { browser } from '$app/environment';
	import MovieCard from '$lib/components/MovieCard.svelte';
	import SearchHeader from '$lib/components/SearchHeader.svelte';
	import SearchFilters from '$lib/components/SearchFilters.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import type { LibraryMovie } from '$lib/types/library';
	import { onDestroy } from 'svelte';
	import {
		addToSearchHistory,
		sortMovies,
		filterMoviesByQuality,
		filterMoviesByOverview,
		type SortOption,
		type QualityFilter
	} from '$lib/utils/searchUtils';

	const trendingQueries = [
		'Deadpool & Wolverine',
		'House of the Dragon',
		'The Boys',
		'John Wick',
		'Attack on Titan',
		'Bridgerton'
	];
	const skeletonSlots = Array.from({ length: 12 });

	let query = $state('');
	let movies = $state<LibraryMovie[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let debounceTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let controller = $state<AbortController | null>(null);
	let sortBy = $state<SortOption>('relevance');
	let qualityFilter = $state<QualityFilter>('any');
	let onlyWithOverview = $state(false);
	let lastSearchedTerm = $state('');

	async function performSearch(rawTerm: string) {
		const trimmed = rawTerm.trim();
		if (!trimmed) {
			movies = [];
			error = null;
			loading = false;
			lastSearchedTerm = '';
			return;
		}

		controller?.abort();
		controller = new AbortController();

		loading = true;
		error = null;
		lastSearchedTerm = trimmed;

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
				signal: controller.signal
			});

			if (!res.ok) throw new Error('Failed to fetch search results');

			const data: LibraryMovie[] = await res.json();
			movies = data;
			addToSearchHistory(trimmed, browser);
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			if (err instanceof Error && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Unable to fetch search results.';
		} finally {
			loading = false;
		}
	}

	function scheduleSearch(term: string) {
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}

		if (!term.trim()) {
			movies = [];
			error = null;
			loading = false;
			lastSearchedTerm = '';
			return;
		}

		debounceTimeout = setTimeout(() => {
			void performSearch(term);
		}, 350);
	}

	$effect(() => {
		scheduleSearch(query);
	});

	function handleSubmit(event: Event) {
		event.preventDefault();
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}
		void performSearch(query);
	}

	function resetFilters() {
		sortBy = 'relevance';
		qualityFilter = 'any';
		onlyWithOverview = false;
	}

	onDestroy(() => {
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}
		controller?.abort();
	});

	const filteredMovies = $derived(() => {
		let result = filterMoviesByQuality(movies, qualityFilter);
		result = filterMoviesByOverview(result, onlyWithOverview);
		return sortMovies(result, sortBy);
	});

	const hasActiveFilters = $derived(
		qualityFilter !== 'any' || onlyWithOverview || sortBy !== 'relevance'
	);

	const resultsSummary = $derived(() => {
		if (!lastSearchedTerm) return '';
		if (error) return '';

		const total = movies.length;
		const visible = filteredMovies().length;

		if (total === 0) {
			return `No matches for "${lastSearchedTerm}".`;
		}

		if (hasActiveFilters && visible !== total) {
			return `Showing ${visible} of ${total} matches for "${lastSearchedTerm}" after filters.`;
		}

		return `Showing ${visible} match${visible === 1 ? '' : 'es'} for "${lastSearchedTerm}".`;
	});
</script>

<div class="min-h-screen">
	<main class="container mx-auto px-2 py-2 md:py-2">
		<section
			class="space-y-10 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-sm sm:p-8"
		>
			<SearchHeader {query} {loading} {performSearch} {handleSubmit} {trendingQueries} />

			<SearchFilters
				{sortBy}
				{qualityFilter}
				{onlyWithOverview}
				{hasActiveFilters}
				onSortChange={(sort: SortOption) => (sortBy = sort)}
				onQualityChange={(q: QualityFilter) => (qualityFilter = q)}
				onResetFilters={resetFilters}
			/>

			{#if resultsSummary}
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm"
				>
					<div class="flex flex-wrap items-center gap-3">
						<Badge
							class="rounded-full border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase"
							variant="outline"
						>
							{lastSearchedTerm}
						</Badge>
						<span class="text-muted-foreground">{resultsSummary}</span>
					</div>
					{#if movies.length > 0}
						<span class="text-xs tracking-wide text-muted-foreground uppercase">
							{filteredMovies().length} visible / {movies.length} total
						</span>
					{/if}
				</div>
			{/if}

			{#if error}
				<Alert variant="destructive" class="border-destructive/40 bg-destructive/10">
					<AlertTitle>Search error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}

			{#if filteredMovies().length > 0}
				<div
					class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
				>
					{#each filteredMovies() as movie (movie.id)}
						<MovieCard movie={movie as LibraryMovie} />
					{/each}
				</div>
			{:else if loading}
				<div
					class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
				>
					{#each skeletonSlots as _, index (index)}
						<MovieCard movie={null} />
					{/each}
				</div>
			{:else}
				<div class="space-y-4">
					{#if lastSearchedTerm && !error}
						<Alert class="border-border/60 bg-background/60">
							<AlertTitle>No matches found</AlertTitle>
							<AlertDescription>
								{hasActiveFilters
									? 'Nothing matched after filters. Try resetting filters or searching for a different title.'
									: 'We could not find that title. Try a different keyword or explore the suggestions below.'}
							</AlertDescription>
						</Alert>
					{/if}
				</div>
			{/if}
		</section>
	</main>
</div>
