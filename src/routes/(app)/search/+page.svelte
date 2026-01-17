<script lang="ts">
	import { browser } from '$app/environment';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import SearchHeader from '$lib/components/search/SearchHeader.svelte';
	import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
	import ActiveFilters from '$lib/components/filters/ActiveFilters.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import type { LibraryMedia } from '$lib/types/library';
	import { onDestroy, onMount } from 'svelte';
	import { addToSearchHistory, type SortOption } from '$lib/utils/searchUtils';
	import type { MovieFilters } from '$lib/types/filters';
	import { page as pageState } from '$app/state';
	import { goto } from '$app/navigation';

	const sortOptions = [
		{ label: 'Best Match', value: 'relevance' as SortOption },
		{ label: 'Top Rated', value: 'rating' as SortOption },
		{ label: 'Newest', value: 'releaseDate' as SortOption },
		{ label: 'Title', value: 'title' as SortOption }
	];

	const SKELETON_COUNT_INITIAL = 12;
	const SKELETON_COUNT_MORE = 6;
	const DEBOUNCE_DELAY = 600;
	const API_FETCH_LIMIT = 24;

	let query = $state(pageState.url.searchParams.get('q') || '');
	let items = $state<LibraryMedia[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;

	let page = $state(1);
	let hasMore = $state(true);
	let lastSubmittedQuery = $state('');

	// Facet data
	let availableGenres = $state<Array<{ id: number; name: string; count: number }>>([]);
	let availableYears = $state<Array<{ year: number; count: number }>>([]);
	let availableRatings = $state<Array<{ rating: number; count: number }>>([]);

	let filters = $state<MovieFilters>({
		genres: pageState.url.searchParams.get('genres')?.split(',').filter(Boolean) || [],
		minRating: pageState.url.searchParams.get('minRating')
			? Number(pageState.url.searchParams.get('minRating'))
			: undefined,
		maxRating: pageState.url.searchParams.get('maxRating')
			? Number(pageState.url.searchParams.get('maxRating'))
			: undefined,
		yearFrom: pageState.url.searchParams.get('yearFrom')
			? Number(pageState.url.searchParams.get('yearFrom'))
			: undefined,
		yearTo: pageState.url.searchParams.get('yearTo')
			? Number(pageState.url.searchParams.get('yearTo'))
			: undefined,
		runtimeMin: pageState.url.searchParams.get('runtimeMin')
			? Number(pageState.url.searchParams.get('runtimeMin'))
			: undefined,
		runtimeMax: pageState.url.searchParams.get('runtimeMax')
			? Number(pageState.url.searchParams.get('runtimeMax'))
			: undefined,
		language: pageState.url.searchParams.get('language') || undefined
	});

	let mediaType = $state<'movie' | 'tv' | 'anime' | undefined>(
		(pageState.url.searchParams.get('type') as any) || undefined
	);

	let sortBy = $state<SortOption>((pageState.url.searchParams.get('sort') as any) || 'relevance');
	let sortOrder = $state<'asc' | 'desc'>(
		(pageState.url.searchParams.get('order') as any) || 'desc'
	);

	let totalItems = $state(0);
	let sentinel: HTMLDivElement | null = $state(null);

	async function fetchItems(searchTerm: string, pageToLoad: number, isInitial = false) {
		if (loading) return;
		if (!isInitial && pageToLoad > 1 && !hasMore) return;

		loading = true;
		error = null;

		if (isInitial) {
			controller?.abort();
			controller = new AbortController();
			page = 1;
		}

		try {
			const params = new URLSearchParams();
			if (searchTerm) params.set('q', searchTerm);
			params.set('offset', String((pageToLoad - 1) * API_FETCH_LIMIT));
			params.set('limit', String(API_FETCH_LIMIT));

			if (filters.genres?.length) params.set('genres', filters.genres.join(','));
			if (filters.minRating) params.set('minRating', String(filters.minRating));
			if (filters.maxRating) params.set('maxRating', String(filters.maxRating));
			if (filters.yearFrom) params.set('minYear', String(filters.yearFrom));
			if (filters.yearTo) params.set('maxYear', String(filters.yearTo));
			if (filters.runtimeMin) params.set('runtimeMin', String(filters.runtimeMin));
			if (filters.runtimeMax) params.set('runtimeMax', String(filters.runtimeMax));
			if (filters.language) params.set('language', filters.language);
			if (mediaType) params.set('mediaType', mediaType);

			params.set('sortBy', sortBy);
			params.set('sortOrder', sortOrder);

			const url = `/api/search/enhanced?${params.toString()}`;
			const res = await fetch(url, { signal: controller?.signal, credentials: 'include' });

			if (!res.ok) throw new Error('Failed to fetch search results');

			const data = await res.json();

			if (pageToLoad === 1) {
				items = data.results;
				totalItems = data.total;

				// Update facets
				availableGenres = data.genres || [];
				availableYears = data.years || [];
				availableRatings = data.ratings || [];

				if (searchTerm.trim()) {
					addToSearchHistory(searchTerm.trim(), browser);
				}
			} else {
				items = [...items, ...data.results];
				totalItems = data.total;
			}

			page = pageToLoad;
			hasMore = items.length < totalItems;

			// Update URL without navigation
			if (browser) {
				const newUrl = new URL(window.location.href);
				if (searchTerm) newUrl.searchParams.set('q', searchTerm);
				else newUrl.searchParams.delete('q');

				if (filters.genres?.length) newUrl.searchParams.set('genres', filters.genres.join(','));
				else newUrl.searchParams.delete('genres');

				if (mediaType) newUrl.searchParams.set('type', mediaType);
				else newUrl.searchParams.delete('type');

				window.history.replaceState({}, '', newUrl.toString());
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Unable to fetch search results.';
		} finally {
			loading = false;
		}
	}

	async function performSearch(term: string) {
		lastSubmittedQuery = term;
		await fetchItems(term, 1, true);
	}

	async function loadMore() {
		if (loading || !hasMore) return;
		await fetchItems(lastSubmittedQuery, page + 1);
	}

	function handleFiltersChange(newFilters: MovieFilters) {
		filters = newFilters;
		void performSearch(query);
	}

	function clearAllFilters() {
		filters = {
			genres: [],
			minRating: undefined,
			maxRating: undefined,
			yearFrom: undefined,
			yearTo: undefined,
			runtimeMin: undefined,
			runtimeMax: undefined,
			language: undefined
		};
		mediaType = undefined;
		void performSearch(query);
	}

	$effect(() => {
		const currentQuery = query;
		if (debounceTimeout) clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (currentQuery !== lastSubmittedQuery) {
				void performSearch(currentQuery);
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
		lastSubmittedQuery = query;
		void fetchItems(query, 1, true);
	});

	onDestroy(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
		controller?.abort();
	});

	const resultsSummary = $derived.by(() => {
		if (error) return '';
		if (items.length === 0 && loading) return 'Searching...';

		if (items.length === 0 && !loading) {
			return lastSubmittedQuery
				? `No matches for "${lastSubmittedQuery}".`
				: 'No items found matching these filters.';
		}

		let summary = `Showing ${items.length}`;
		if (totalItems > 0) {
			summary += ` out of ${totalItems} results`;
		}

		if (lastSubmittedQuery) summary += ` for "${lastSubmittedQuery}"`;
		if (hasMore) summary += '. Scroll to load more.';

		return summary;
	});

	const skeletonCount = $derived(items.length > 0 ? SKELETON_COUNT_MORE : SKELETON_COUNT_INITIAL);
</script>

<div class="min-h-screen pt-20">
	<main class="container mx-auto px-4 py-8">
		<div class="flex flex-col gap-8 lg:flex-row">
			<!-- Sidebar -->
			<aside class="w-full shrink-0 lg:w-64 xl:w-80">
				<div class="sticky top-24 space-y-6">
					<FilterPanel
						{filters}
						{availableGenres}
						include_anime={mediaType === 'anime'
							? 'only'
							: mediaType === 'tv'
								? 'exclude'
								: 'include'}
						onFiltersChange={handleFiltersChange}
						onClearAll={clearAllFilters}
					/>
				</div>
			</aside>

			<!-- Main Content -->
			<div class="flex-1 space-y-6">
				<SearchHeader
					bind:query
					{performSearch}
					trendingQueries={['Action', 'Comedy', 'Horror', 'Sci-Fi']}
					{sortOptions}
					qualityOptions={[]}
					bind:sortBy
				/>

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						{#if resultsSummary}
							<p class="text-sm text-muted-foreground" aria-live="polite">{resultsSummary}</p>
						{/if}
					</div>

					<ActiveFilters
						{filters}
						{mediaType}
						onRemove={(updates) => {
							if ('mediaType' in updates) mediaType = undefined;
							else handleFiltersChange({ ...filters, ...updates });
						}}
					/>

					{#if error}
						<Alert variant="destructive" class="border-destructive/40 bg-destructive/10">
							<AlertTitle>Search error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					{/if}

					{#if items.length > 0}
						<div
							class="grid grid-cols-2 justify-center gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
						>
							{#each items as item (item.id)}
								<MediaCard movie={item} />
							{/each}
						</div>
					{/if}

					{#if loading}
						<div
							class="grid grid-cols-2 justify-center gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
						>
							{#each Array(skeletonCount) as _index (Math.random())}
								<MediaCard movie={null} />
							{/each}
						</div>
					{/if}

					{#if !loading && items.length === 0 && !error}
						<Alert class="border-border/60 bg-background/60">
							<AlertTitle>No matches found</AlertTitle>
							<AlertDescription>
								Try adjusting your filters or searching for a different title.
							</AlertDescription>
						</Alert>
					{/if}

					<div bind:this={sentinel} class="h-10 w-full"></div>
				</div>
			</div>
		</div>
	</main>
</div>
