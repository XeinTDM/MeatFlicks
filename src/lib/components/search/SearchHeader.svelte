<script lang="ts">
	import { browser } from '$app/environment';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Search as SearchIcon, History as HistoryIcon } from '@lucide/svelte';
	import { addToSearchHistory, getSearchHistory, clearSearchHistory } from '$lib/utils/searchUtils';
	import type { SortOption, QualityFilter } from '$lib/utils/searchUtils';

	let {
		query = $bindable(),
		performSearch,
		trendingQueries,
		sortOptions = [],
		qualityOptions = [],
		sortBy = $bindable('relevance'),
		qualityFilter = $bindable('any')
	}: {
		query: string;
		performSearch: (term: string) => Promise<void>;
		trendingQueries: string[];
		sortOptions?: Array<{ label: string; value: SortOption }>;
		qualityOptions?: Array<{ label: string; value: QualityFilter }>;
		sortBy?: SortOption;
		qualityFilter?: QualityFilter;
	} = $props();

	let searchHistory = $state(getSearchHistory(browser));
	let showHistory = $state(false);

	function handleQuickSearch(term: string) {
		query = term;
		addToSearchHistory(term, browser);
		performSearch(term);
	}

	function clearHistory() {
		searchHistory = clearSearchHistory(browser);
		showHistory = false;
	}
</script>

<section class="space-y-6 rounded-3xl">
	<div class="space-y-3">
		<h1 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
			Find something to watch right now
		</h1>
		<p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
			Search every movie, series, and anime available on MeatFlicks. Filter by quality, jump back
			into recent searches, and start streaming in seconds.
		</p>
	</div>

	<div class="flex flex-col gap-3 md:flex-row">
		<div class="relative flex-1">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				placeholder="Search titles, people, or keywords..."
				class="h-12 w-full rounded-2xl border border-border/60 bg-background/60 pl-12 text-base shadow-sm focus-visible:border-primary focus-visible:ring-primary/40"
				bind:value={query}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						handleQuickSearch(query);
					}
				}}
				aria-label="Search the MeatFlicks library"
			/>
		</div>

		{#if sortOptions.length > 0 && qualityOptions.length > 0}
			<div class="flex flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-4">
				<div class="space-y-1">
					<div class="flex flex-wrap gap-2">
						{#each sortOptions as option (option.value)}
							<Button
								type="button"
								size="sm"
								variant={sortBy === option.value ? 'default' : 'outline'}
								class="h-8 rounded-full px-3 text-xs font-semibold"
								onclick={() => (sortBy = option.value)}
							>
								{option.label}
							</Button>
						{/each}
					</div>
				</div>

				<div class="space-y-1">
					<div class="flex flex-wrap gap-2">
						{#each qualityOptions as option (option.value)}
							<Button
								type="button"
								size="sm"
								variant={qualityFilter === option.value ? 'default' : 'outline'}
								class="h-8 rounded-full px-3 text-xs font-semibold"
								onclick={() => (qualityFilter = option.value)}
							>
								{option.label}
							</Button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
		<span class="font-medium text-foreground">Trending now:</span>
		{#each trendingQueries as item (item)}
			<Button
				type="button"
				variant="secondary"
				size="sm"
				class="h-8 rounded-full border border-border/60 bg-background/70 px-3 text-xs font-medium hover:bg-background"
				onclick={() => handleQuickSearch(item)}
			>
				{item}
			</Button>
		{/each}
	</div>

	{#if searchHistory.length > 0}
		<div class="flex items-center justify-start text-sm">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-8 gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
				onclick={() => (showHistory = !showHistory)}
			>
				<HistoryIcon class="size-3.5" />
				{showHistory ? 'Hide' : 'Show'} recent searches
			</Button>
		</div>

		{#if showHistory}
			<div class="space-y-2 rounded-2xl border border-border/40 bg-background/50 p-4">
				<div class="flex items-center justify-between text-sm font-medium text-foreground">
					<span class="flex items-center gap-2">
						<HistoryIcon class="size-4 text-muted-foreground" />
						Recent searches
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
						onclick={clearHistory}
					>
						Clear
					</Button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each searchHistory as term (term)}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="h-8 rounded-full border border-transparent bg-background/80 px-3 text-xs font-medium text-foreground hover:border-border/40 hover:bg-background"
							onclick={() => handleQuickSearch(term)}
						>
							{term}
						</Button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</section>
