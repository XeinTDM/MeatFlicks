<script lang="ts">
	import { browser } from '$app/environment';
	import MovieCard from '$lib/components/media/MovieCard.svelte';
	import SearchHeader from '$lib/components/search/SearchHeader.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import type { LibraryMovie } from '$lib/types/library';
	import { onDestroy, onMount } from 'svelte';
	import {
		addToSearchHistory,
		filterMoviesByQuality,
		sortMovies,
		type QualityFilter,
		type SortOption
	} from '$lib/utils/searchUtils';

	const sortOptions = [
		{ label: 'Best Match', value: 'relevance' as SortOption },
		{ label: 'Top Rated', value: 'rating' as SortOption },
		{ label: 'Newest', value: 'newest' as SortOption }
	];

	const qualityOptions = [
		{ label: 'Any Quality', value: 'any' as QualityFilter },
		{ label: 'HD & up', value: 'hd' as QualityFilter },
		{ label: '4K only', value: '4k' as QualityFilter }
	];

	const SKELETON_COUNT_INITIAL = 12;
	const SKELETON_COUNT_MORE = 6;
	const DEBOUNCE_DELAY = 600;
	const API_FETCH_LIMIT = 24;

	let query = $state('');
	let items = $state<LibraryMovie[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;

	let page = $state(1);
	let hasMore = $state(true);
	let lastSubmittedQuery = $state('');

	let sortBy = $state<SortOption>('relevance');
	let qualityFilter = $state<QualityFilter>('any');

	let sentinel: HTMLDivElement | null = $state(null);

	async function fetchItems(searchTerm: string, pageToLoad: number) {
		if (loading) return;
		if (pageToLoad > 1 && !hasMore) return;

		loading = true;
		error = null;

		if (pageToLoad === 1) {
			controller?.abort();
			controller = new AbortController();
		}

		try {
			const url = `/api/search?q=${encodeURIComponent(
				searchTerm
			)}&page=${pageToLoad}&limit=${API_FETCH_LIMIT}`;
			const res = await fetch(url, { signal: controller?.signal, credentials: 'include' });

			if (!res.ok) throw new Error('Failed to fetch search results');

			const data: LibraryMovie[] = await res.json();

			if (pageToLoad === 1) {
				items = data;
				if (searchTerm.trim()) {
					addToSearchHistory(searchTerm.trim(), browser);
				}
			} else {
				items = [...items, ...data];
			}

			page = pageToLoad;
			hasMore = data.length === API_FETCH_LIMIT;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Unable to fetch search results.';
		} finally {
			loading = false;
		}
	}

	async function performSearch(term: string) {
		lastSubmittedQuery = term;
		await fetchItems(term, 1);
	}

	async function loadMore() {
		if (loading || !hasMore) return;
		await fetchItems(lastSubmittedQuery, page + 1);
	}

	$effect(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (query !== lastSubmittedQuery) {
				void performSearch(query);
			}
		}, DEBOUNCE_DELAY);
	});

	$effect(() => {
		if (!browser || !sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					void loadMore();
				}
			},
			{ rootMargin: '200px' }
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	onMount(() => {
		void performSearch(query);
	});

	onDestroy(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
		controller?.abort();
	});

	const filteredItems = $derived.by(() => {
		let result = filterMoviesByQuality(items, qualityFilter);
		return sortMovies(result, sortBy);
	});

	const hasActiveFilters = $derived(qualityFilter !== 'any' || sortBy !== 'relevance');

	const resultsSummary = $derived.by(() => {
		if (error) return '';
		if (items.length === 0 && loading) return 'Loading...';

		const visibleCount = filteredItems.length;

		if (items.length === 0 && !loading) {
			return lastSubmittedQuery
				? `No matches for "${lastSubmittedQuery}".`
				: 'No media items found.';
		}

		let summary = `Showing ${visibleCount} results`;
		if (lastSubmittedQuery) summary += ` for "${lastSubmittedQuery}"`;
		if (hasActiveFilters && visibleCount !== items.length) {
			summary += ` (filtered from ${items.length})`;
		}
		if (hasMore) summary += '. Scroll to load more.';

		return summary;
	});

	const skeletonCount = $derived(items.length > 0 ? SKELETON_COUNT_MORE : SKELETON_COUNT_INITIAL);
</script>

<div class="min-h-screen">
	<main class="container w-full py-2 pr-2 md:py-2">
		<section class="space-y-4 p-6 shadow-xl backdrop-blur-sm sm:p-8">
			<SearchHeader
				bind:query
				{performSearch}
				trendingQueries={[]}
				{sortOptions}
				{qualityOptions}
				bind:sortBy
				bind:qualityFilter
			/>

			{#if resultsSummary}
				<p class="text-sm text-muted-foreground" aria-live="polite">{resultsSummary}</p>
			{/if}

			{#if error}
				<Alert variant="destructive" class="border-destructive/40 bg-destructive/10">
					<AlertTitle>Search error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			{/if}

			{#if filteredItems.length > 0}
				<div
					class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
				>
					{#each filteredItems as item (item.id)}
						<MovieCard movie={item as LibraryMovie} />
					{/each}
				</div>
			{/if}

			{#if loading}
				<div
					class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
				>
					{#each Array(skeletonCount) as _index (Math.random())}
						<MovieCard movie={null} />
					{/each}
				</div>
			{/if}

			{#if !loading && items.length === 0 && !error}
				<Alert class="border-border/60 bg-background/60">
					<AlertTitle>No matches found</AlertTitle>
					<AlertDescription>
						{hasActiveFilters
							? 'Try adjusting your filters or searching for a different title.'
							: 'We could not find anything matching your search. Please try a different keyword.'}
					</AlertDescription>
				</Alert>
			{/if}
			<div bind:this={sentinel} class="h-10 w-full"></div>
		</section>
	</main>
</div>
