<script lang="ts">
	import { browser } from '$app/environment';
	import MovieCard from '$lib/components/MovieCard.svelte';
	import SearchHeader from '$lib/components/SearchHeader.svelte';
	import AdvancedSearchFilters from '$lib/components/search/AdvancedSearchFilters.svelte';
	import SearchHistory from '$lib/components/search/SearchHistory.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import type { LibraryMovie } from '$lib/types/library';
	import { onDestroy, onMount } from 'svelte';
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
	let searchHistoryItems = $state<Array<{ id: number; query: string; searchedAt: number }>>([]);
	let showHistory = $derived(!lastSearchedTerm && searchHistoryItems.length > 0);
	let selectedActors = $state<any[]>([]);
	let selectedDirectors = $state<any[]>([]);

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
				signal: controller.signal,
				credentials: 'include'
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
		selectedActors = [];
		selectedDirectors = [];
	}

	async function searchByPeople() {
		if (selectedActors.length === 0 && selectedDirectors.length === 0) {
			return;
		}

		loading = true;
		error = null;

		try {
			const actorIds = selectedActors.map((a: any) => a.id);
			const directorIds = selectedDirectors.map((d: any) => d.id);
			const allPersonIds = [...actorIds, ...directorIds];
			const roles = [];

			if (actorIds.length > 0) roles.push('actor');
			if (directorIds.length > 0) roles.push('director');

			const searchParams = new URLSearchParams({
				people: allPersonIds.join(','),
				roles: roles.join(',')
			});

			const res = await fetch(`/api/search/movies-by-people?${searchParams.toString()}`, {
				credentials: 'include'
			});

			if (!res.ok) throw new Error('Failed to fetch movies by people');

			const data: LibraryMovie[] = await res.json();
			movies = data;
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Unable to fetch movies by people.';
		} finally {
			loading = false;
		}
	}

	async function loadSearchHistory() {
		if (!browser) return;
		try {
			const response = await fetch('/api/search/history', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				searchHistoryItems = data.searches || [];
			}
		} catch (error) {
			console.error('Failed to load search history:', error);
		}
	}

	async function handleSearchSelect(selectedQuery: string) {
		query = selectedQuery;
		await performSearch(selectedQuery);
	}

	async function handleDeleteHistory(id: number) {
		try {
			const response = await fetch('/api/search/history', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
				credentials: 'include'
			});
			if (response.ok) {
				searchHistoryItems = searchHistoryItems.filter((item) => item.id !== id);
			}
		} catch (error) {
			console.error('Failed to delete search history item:', error);
		}
	}

	async function handleClearHistory() {
		try {
			const response = await fetch('/api/search/history', {
				method: 'DELETE',
				credentials: 'include'
			});
			if (response.ok) {
				searchHistoryItems = [];
			}
		} catch (error) {
			console.error('Failed to clear search history:', error);
		}
	}

	onMount(() => {
		void loadSearchHistory();
	});

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
		qualityFilter !== 'any' ||
			onlyWithOverview ||
			sortBy !== 'relevance' ||
			selectedActors.length > 0 ||
			selectedDirectors.length > 0
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
	<main class="container w-full py-2 pr-2 md:py-2">
		<section
			class="space-y-2 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-sm sm:p-8"
		>
			<SearchHeader {query} {loading} {performSearch} {handleSubmit} {trendingQueries} />

			{#if showHistory}
				<SearchHistory
					searches={searchHistoryItems}
					onSearchSelect={handleSearchSelect}
					onDelete={handleDeleteHistory}
					onClearAll={handleClearHistory}
					maxItems={10}
				/>
			{/if}

			<AdvancedSearchFilters
				{sortBy}
				{qualityFilter}
				{onlyWithOverview}
				{hasActiveFilters}
				onSortChange={(sort: SortOption) => (sortBy = sort)}
				onQualityChange={(q: QualityFilter) => (qualityFilter = q)}
				onOverviewToggle={(enabled: boolean) => (onlyWithOverview = enabled)}
				onResetFilters={resetFilters}
				onActorsChange={(actors: any[]) => {
					selectedActors = actors;
					if (selectedActors.length > 0 || selectedDirectors.length > 0) {
						void searchByPeople();
					}
				}}
				onDirectorsChange={(directors: any[]) => {
					selectedDirectors = directors;
					if (selectedActors.length > 0 || selectedDirectors.length > 0) {
						void searchByPeople();
					}
				}}
			/>

			{#if true}
				{@const visibleMovies = filteredMovies()}
				{@const summaryText = resultsSummary()}

				{#if summaryText}
					<p class="text-sm text-muted-foreground" aria-live="polite">{summaryText}</p>
				{/if}

				{#if error}
					<Alert variant="destructive" class="border-destructive/40 bg-destructive/10">
						<AlertTitle>Search error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}

				{#if visibleMovies.length > 0}
					<div
						class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
					>
						{#each visibleMovies as movie (movie.id)}
							<MovieCard movie={movie as LibraryMovie} />
						{/each}
					</div>
				{:else if loading}
					<div
						class="grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
					>
						{#each skeletonSlots as slot, index (index)}
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
			{/if}
		</section>
	</main>
</div>
