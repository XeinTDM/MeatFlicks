<script lang="ts">
	import { Search as SearchIcon, X, Loader2, Play, Clock } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import SearchHistory from '$lib/components/search/SearchHistory.svelte';
	import { searchHistory } from '$lib/state/stores/searchHistoryStore';

	interface SearchHistoryItem {
		id: number;
		query: string;
		searchedAt: number;
	}

	let query = $state('');
	let results = $state<LibraryMovie[]>([]);
	let isLoading = $state(false);
	let isFocused = $state(false);
	let searchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let containerRef = $state<HTMLElement | null>(null);
	let isLoadingHistory = $state(false);

	// Get search history from store
	$effect(() => {
		const unsubscribe = searchHistory.subscribe(($searchHistory) => {
			// No need to do anything here since we're using the store directly
		});
		return unsubscribe;
	});

	async function fetchResults(q: string) {
		if (!q.trim()) {
			results = [];
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
				credentials: 'include'
			});
			if (res.ok) {
				results = await res.json();
			}
		} catch (error) {
			console.error('[global-search] error', error);
		} finally {
			isLoading = false;
		}
	}

	async function saveSearch(query: string) {
		if (!query.trim()) return;
		try {
			// Use the search history store which handles both authenticated and unauthenticated users
			await searchHistory.addSearch(query);
		} catch (error) {
			// Silently fail - saving history is optional
			console.error('[global-search] error saving history', error);
		}
	}

	async function deleteSearch(id: number) {
		try {
			// Use the search history store which handles both authenticated and unauthenticated users
			await searchHistory.deleteSearch(id);
		} catch (error) {
			console.error('[global-search] error deleting history', error);
		}
	}

	async function clearAllHistory() {
		try {
			// Use the search history store which handles both authenticated and unauthenticated users
			await searchHistory.clearAll();
		} catch (error) {
			console.error('[global-search] error clearing history', error);
		}
	}

	function handleHistorySelect(historyQuery: string) {
		query = historyQuery;
		fetchResults(historyQuery);
	}

	onMount(() => {
		// The search history store automatically syncs on initialization
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		query = target.value;

		if (searchTimeout) clearTimeout(searchTimeout);

		if (!query.trim()) {
			results = [];
			isLoading = false;
			return;
		}

		searchTimeout = setTimeout(() => {
			fetchResults(query);
		}, 300);
	}

	function clearSearch() {
		query = '';
		results = [];
		isLoading = false;
	}

	function handleNavigate(movie: LibraryMovie) {
		const path = movie.canonicalPath ?? `/movie/${movie.id}`;
		goto(path);
		clearSearch();
		isFocused = false;
	}

	async function handleGlobalSearch() {
		if (query.trim()) {
			await saveSearch(query);
			goto(`/search?q=${encodeURIComponent(query)}`);
			isFocused = false;
		}
	}

	// Close on click outside
	$effect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef && !containerRef.contains(e.target as Node)) {
				isFocused = false;
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});
</script>

<div class="relative w-full" bind:this={containerRef}>
	<div
		class="group flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/40 px-4 py-2 transition-all duration-300 focus-within:border-primary/50 focus-within:bg-muted/60"
	>
		<SearchIcon
			class="size-4 text-muted-foreground transition-colors group-focus-within:text-primary"
		/>
		<input
			type="text"
			placeholder="Search movies, tv series..."
			class="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			value={query}
			oninput={handleInput}
			onfocus={() => {
				isFocused = true;
			}}
			onkeydown={(e) => e.key === 'Enter' && handleGlobalSearch()}
		/>
		{#if query}
			<button
				onclick={clearSearch}
				class="rounded-full p-1 transition-colors hover:bg-muted"
				transition:fade={{ duration: 150 }}
			>
				<X class="size-3 text-muted-foreground" />
			</button>
		{/if}
	</div>

	{#if isFocused && ($searchHistory.history.length > 0 || results.length > 0 || isLoading)}
		<div
			class="absolute top-full right-0 left-0 z-[100] mt-3 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
			transition:slide={{ duration: 200 }}
		>
			{#if $searchHistory.history.length > 0 && !query.trim()}
				<!-- Show search history when input is focused and empty -->
				<div class="p-2">
					<div
						class="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground"
					>
						<Clock class="size-3" />
						Recent Searches
					</div>
					<SearchHistory
						searches={$searchHistory.history}
						onSearchSelect={handleHistorySelect}
						onDelete={deleteSearch}
						onClearAll={clearAllHistory}
						maxItems={5}
					/>
				</div>
			{:else if isLoading}
				<div class="flex items-center justify-center p-8">
					<Loader2 class="size-6 animate-spin text-primary" />
				</div>
			{:else if results.length > 0}
				<ul class="space-y-1">
					{#each results.slice(0, 5) as movie}
						<li>
							<button
								onclick={() => handleNavigate(movie)}
								class="group flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-primary/10"
							>
								<div class="h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
									{#if movie.posterPath}
										<img src={movie.posterPath} alt="" class="h-full w-full object-cover" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<h4
										class="truncate text-sm font-semibold transition-colors group-hover:text-primary"
									>
										{movie.title}
									</h4>
									<p class="truncate text-xs text-muted-foreground">
										{movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A'} • {movie.media_type ===
										'tv'
											? 'TV'
											: 'Movie'}
									</p>
								</div>
								<Play
									class="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100"
								/>
							</button>
						</li>
					{/each}
					<li class="mt-1 border-t border-border/40 pt-2">
						<button
							onclick={handleGlobalSearch}
							class="w-full p-2 text-center text-xs font-bold text-primary hover:underline"
						>
							View all results for "{query}"
						</button>
					</li>
				</ul>
			{/if}
		</div>
	{/if}
</div>
