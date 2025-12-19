<script lang="ts">
	import { ChevronDown, ChevronUp, Filter, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Card from '$lib/components/ui/card';
	import type { MovieFilters } from '$lib/types/filters';
	import { countActiveFilters, hasActiveFilters } from '$lib/types/filters';
	import YearRangeFilter from './YearRangeFilter.svelte';
	import RatingFilter from './RatingFilter.svelte';
	import RuntimeFilter from './RuntimeFilter.svelte';
	import LanguageFilter from './LanguageFilter.svelte';
	import MultiGenreFilter from './MultiGenreFilter.svelte';

	interface Props {
		filters: MovieFilters;
		availableGenres?: Array<{ id: number; name: string }>;
		onFiltersChange: (filters: MovieFilters) => void;
		onClearAll: () => void;
	}

	let {
		filters = $bindable(),
		availableGenres = [],
		onFiltersChange,
		onClearAll
	}: Props = $props();

	let isExpanded = $state(true);
	let activeFilterCount = $derived(countActiveFilters(filters));
	let hasFilters = $derived(hasActiveFilters(filters));

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function updateFilters(updates: Partial<MovieFilters>) {
		const newFilters = { ...filters, ...updates };
		onFiltersChange(newFilters);
	}

	function clearAllFilters() {
		onClearAll();
	}
</script>

<Card.Root class="overflow-hidden border-border/60">
	<Card.Header class="pb-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<Filter class="h-5 w-5 text-primary" />
				</div>
				<div>
					<Card.Title class="text-lg font-semibold">Filters</Card.Title>
					{#if activeFilterCount > 0}
						<Card.Description class="text-xs">
							{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
						</Card.Description>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if hasFilters}
					<Button
						variant="ghost"
						size="sm"
						onclick={clearAllFilters}
						class="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
					>
						<X class="h-3 w-3" />
						Clear all
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="icon"
					onclick={toggleExpanded}
					class="h-8 w-8"
					aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
				>
					{#if isExpanded}
						<ChevronUp class="h-4 w-4" />
					{:else}
						<ChevronDown class="h-4 w-4" />
					{/if}
				</Button>
			</div>
		</div>
	</Card.Header>

	{#if isExpanded}
		<Card.Content class="space-y-6 pt-0">
			<!-- Year Range Filter -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground">Release Year</h3>
				<YearRangeFilter
					yearFrom={filters.yearFrom}
					yearTo={filters.yearTo}
					onYearFromChange={(year) => updateFilters({ yearFrom: year })}
					onYearToChange={(year) => updateFilters({ yearTo: year })}
				/>
			</div>

			<Separator class="bg-border/60" />

			<!-- Rating Filter -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground">Rating</h3>
				<RatingFilter
					minRating={filters.minRating}
					maxRating={filters.maxRating}
					onMinRatingChange={(rating) => updateFilters({ minRating: rating })}
					onMaxRatingChange={(rating) => updateFilters({ maxRating: rating })}
				/>
			</div>

			<Separator class="bg-border/60" />

			<!-- Runtime Filter -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground">Runtime</h3>
				<RuntimeFilter
					runtimeMin={filters.runtimeMin}
					runtimeMax={filters.runtimeMax}
					onRuntimeMinChange={(runtime) => updateFilters({ runtimeMin: runtime })}
					onRuntimeMaxChange={(runtime) => updateFilters({ runtimeMax: runtime })}
				/>
			</div>

			<Separator class="bg-border/60" />

			<!-- Language Filter -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground">Language</h3>
				<LanguageFilter
					language={filters.language}
					onLanguageChange={(lang) => updateFilters({ language: lang })}
				/>
			</div>

			<Separator class="bg-border/60" />

			<!-- Multi-Genre Filter -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-foreground">Genres</h3>
				<MultiGenreFilter
					selectedGenres={filters.genres || []}
					genreMode={filters.genreMode || 'OR'}
					{availableGenres}
					onGenresChange={(genres) => updateFilters({ genres })}
					onGenreModeChange={(mode) => updateFilters({ genreMode: mode })}
				/>
			</div>
		</Card.Content>
	{/if}
</Card.Root>

<style>
	:global(.filter-panel-transition) {
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
