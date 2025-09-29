<script lang="ts">
	import { browser } from '$app/environment';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import {
		Search as SearchIcon,
		LoaderCircle,
		Sparkles as SparklesIcon,
		History as HistoryIcon
	} from '@lucide/svelte';
	import { addToSearchHistory, getSearchHistory, clearSearchHistory } from '$lib/utils/searchUtils';

	let {
		query,
		loading,
		performSearch,
		handleSubmit,
		trendingQueries
	}: {
		query: string;
		loading: boolean;
		performSearch: (term: string) => Promise<void>;
		handleSubmit: (event: Event) => void;
		trendingQueries: string[];
	} = $props();

	let searchHistory = $state<string[]>([]);

	$effect(() => {
		searchHistory = getSearchHistory(browser);
	});

	function handleQuickSearch(term: string) {
		query = term;
		addToSearchHistory(term, browser);
		performSearch(term);
	}

	function clearHistory() {
		searchHistory = clearSearchHistory(browser);
	}
</script>

<section
	class="space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-sm sm:p-8"
>
	<div class="space-y-3">
		<span
			class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
		>
			<SparklesIcon class="size-4" />
			Instant streaming search
		</span>
		<h1 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
			Find something to watch right now
		</h1>
		<p class="max-w-2xl text-base text-muted-foreground sm:text-lg">
			Search every movie, series, and anime available on MeatFlicks. Filter by quality, jump back
			into recent searches, and start streaming in seconds.
		</p>
	</div>

	<form class="flex flex-col gap-3 md:flex-row" onsubmit={handleSubmit}>
		<div class="relative flex-1">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				placeholder="Search titles, people, or keywords..."
				class="h-12 w-full rounded-2xl border border-border/60 bg-background/60 pl-12 text-base shadow-sm focus-visible:border-primary focus-visible:ring-primary/40"
				bind:value={query}
				aria-label="Search the MeatFlicks library"
			/>
		</div>
		<Button type="submit" class="h-12 min-w-[120px] rounded-2xl text-base font-semibold">
			{#if loading}
				<LoaderCircle class="mr-2 size-4 animate-spin" />
			{/if}
			Search
		</Button>
	</form>

	<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
		<span class="font-medium text-foreground">Trending now:</span>
		{#each trendingQueries as item}
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
				{#each searchHistory as term}
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
</section>
