<script lang="ts">
	import { Search as SearchIcon, X, Loader2, Play } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { fade, slide } from 'svelte/transition';
	import type { LibraryMovie } from '$lib/types/library';

	let query = $state('');
	let results = $state<LibraryMovie[]>([]);
	let isLoading = $state(false);
	let isFocused = $state(false);
	let searchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let containerRef = $state<HTMLElement | null>(null);

	async function fetchResults(q: string) {
		if (!q.trim()) {
			results = [];
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
			if (res.ok) {
				results = await res.json();
			}
		} catch (error) {
			console.error('[global-search] error', error);
		} finally {
			isLoading = false;
		}
	}

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

	function handleGlobalSearch() {
		if (query.trim()) {
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
			onfocus={() => (isFocused = true)}
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

	{#if isFocused && (results.length > 0 || isLoading)}
		<div
			class="absolute top-full right-0 left-0 z-[100] mt-3 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
			transition:slide={{ duration: 200 }}
		>
			{#if isLoading}
				<div class="flex items-center justify-center p-8">
					<Loader2 class="size-6 animate-spin text-primary" />
				</div>
			{:else}
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
