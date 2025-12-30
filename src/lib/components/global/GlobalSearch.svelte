<script lang="ts">
	import { Search as SearchIcon, X, Play, Clock, WifiOff } from '@lucide/svelte';
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';
	import SearchHistory from '$lib/components/search/SearchHistory.svelte';
	import { searchHistory } from '$lib/state/stores/searchHistoryStore';
	import { Spinner } from '$lib/components/ui/spinner/index';
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import { watchHistory } from '$lib/state/stores/historyStore';

	let query = $state('');
	let results = $state<LibraryMovie[]>([]);
	let isLoading = $state(false);
	let isFocused = $state(false);
	let isOffline = $state(!navigator.onLine);
	let searchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let containerRef = $state<HTMLElement | null>(null);

	$effect(() => {
		const unsubscribe = searchHistory.subscribe(() => {
			// Ignore
		});
		return unsubscribe;
	});

	$effect(() => {
		const handleOnline = () => { isOffline = false; };
		const handleOffline = () => { isOffline = true; };

		if (typeof window !== 'undefined') {
			window.addEventListener('online', handleOnline);
			window.addEventListener('offline', handleOffline);

			return () => {
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
			};
		}
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
			} else {
				throw new Error('Search failed');
			}
		} catch (error) {
			console.error('[global-search] Online search failed, trying offline search', error);
			results = performOfflineSearch(q);
		} finally {
			isLoading = false;
		}
	}

	function performOfflineSearch(query: string): LibraryMovie[] {
		const searchTerm = query.toLowerCase().trim();
		if (!searchTerm) return [];

		const watchlistMovies = $watchlist.watchlist.map(movie => ({
			id: movie.id,
			tmdbId: movie.tmdbId || null,
			title: movie.title,
			overview: movie.overview,
			posterPath: movie.posterPath,
			backdropPath: movie.backdropPath,
			releaseDate: movie.releaseDate,
			rating: movie.rating,
			durationMinutes: movie.durationMinutes || null,
			genres: movie.genres,
			is4K: movie.is4K || false,
			isHD: movie.isHD || false,
			canonicalPath: movie.canonicalPath || `/movie/${movie.id}`,
			mediaType: movie.media_type || movie.mediaType || 'movie',
			addedAt: Date.parse(movie.addedAt) || Date.now()
		} as LibraryMovie));

		const historyMovies = $watchHistory.entries.map(entry => ({
			id: entry.id,
			tmdbId: entry.tmdbId || null,
			title: entry.title,
			overview: entry.overview,
			posterPath: entry.posterPath,
			backdropPath: entry.backdropPath,
			releaseDate: entry.releaseDate,
			rating: entry.rating,
			durationMinutes: entry.durationMinutes || null,
			genres: entry.genres,
			is4K: entry.is4K || false,
			isHD: entry.isHD || false,
			canonicalPath: entry.canonicalPath || `/movie/${entry.id}`,
			mediaType: entry.media_type || entry.mediaType || 'movie',
			addedAt: Date.parse(entry.watchedAt) || Date.now()
		} as LibraryMovie));

		const allMovies = [...watchlistMovies, ...historyMovies];

		const uniqueMovies = allMovies.filter((movie, index, arr) =>
			arr.findIndex(m => m.id === movie.id) === index
		);

		return uniqueMovies
			.filter(movie => {
				const title = movie.title?.toLowerCase() || '';
				const overview = movie.overview?.toLowerCase() || '';
				const genres = movie.genres?.join(' ').toLowerCase() || '';

				return title.includes(searchTerm) ||
					   overview.includes(searchTerm) ||
					   genres.includes(searchTerm);
			})
			.slice(0, 5);
	}

	async function saveSearch(query: string) {
		if (!query.trim()) return;
		try {
			await searchHistory.addSearch(query);
		} catch (error) {
			console.error('[global-search] error saving history', error);
		}
	}

	async function deleteSearch(id: number) {
		try {
			await searchHistory.deleteSearch(id);
		} catch (error) {
			console.error('[global-search] error deleting history', error);
		}
	}

	async function clearAllHistory() {
		try {
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
		// Ignore
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
		}, 150);
	}

	function clearSearch() {
		query = '';
		results = [];
		isLoading = false;
	}

	function handleNavigate(movie: LibraryMovie) {
		const path = movie.canonicalPath ?? `/movie/${movie.id}`;
		window.location.href = path;
		clearSearch();
		isFocused = false;
	}

	async function handleGlobalSearch() {
		if (query.trim()) {
			await saveSearch(query);
			window.location.href = `/search?q=${encodeURIComponent(query)}`;
			isFocused = false;
		}
	}

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
					<Spinner class="size-6" />
				</div>
			{:else if results.length > 0}
				<div class="space-y-1">
					{#if isOffline}
						<div class="flex items-center gap-2 px-2 py-1 text-xs text-amber-600 bg-amber-50 rounded-md border border-amber-200">
							<WifiOff class="size-3" />
							Offline results from your watchlist & history
						</div>
					{/if}
					<ul class="space-y-1">
						{#each results.slice(0, 5) as movie (movie.id)}
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
											{movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A'} • {movie.mediaType ===
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
						{#if !isOffline}
							<li class="mt-1 border-t border-border/40 pt-2">
								<button
									onclick={handleGlobalSearch}
									class="w-full p-2 text-center text-xs font-bold text-primary hover:underline"
								>
									View all results for "{query}"
								</button>
							</li>
						{/if}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
