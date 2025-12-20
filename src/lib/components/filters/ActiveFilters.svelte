<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { X } from '@lucide/svelte';
	import type { MovieFilters } from '$lib/types/filters';
	import { LANGUAGE_OPTIONS } from '$lib/types/filters';

	interface Props {
		filters: MovieFilters;
		onRemoveFilter: (filterKey: keyof MovieFilters) => void;
		onClearAll: () => void;
	}

	let { filters, onRemoveFilter, onClearAll }: Props = $props();

	interface FilterChip {
		key: keyof MovieFilters;
		label: string;
		value: string;
	}

	let activeFilterChips: FilterChip[] = [];

	$effect(() => {
		const chips: FilterChip[] = [];

		// Year range
		if (filters.yearFrom || filters.yearTo) {
			let label = 'Year: ';
			if (filters.yearFrom && filters.yearTo) {
				label += `${filters.yearFrom}-${filters.yearTo}`;
			} else if (filters.yearFrom) {
				label += `From ${filters.yearFrom}`;
			} else if (filters.yearTo) {
				label += `Until ${filters.yearTo}`;
			}
			chips.push({ key: 'yearFrom', label, value: '' });
		}

		// Rating
		if (filters.minRating !== undefined) {
			chips.push({
				key: 'minRating',
				label: `Rating: ${filters.minRating}+`,
				value: filters.minRating.toString()
			});
		}

		// Runtime
		if (filters.runtimeMin || filters.runtimeMax) {
			let label = 'Runtime: ';
			if (filters.runtimeMin && filters.runtimeMax) {
				label += `${filters.runtimeMin}-${filters.runtimeMax} min`;
			} else if (filters.runtimeMin) {
				label += `${filters.runtimeMin}+ min`;
			} else if (filters.runtimeMax) {
				label += `Up to ${filters.runtimeMax} min`;
			}
			chips.push({ key: 'runtimeMin', label, value: '' });
		}

		// Language
		if (filters.language) {
			const lang = LANGUAGE_OPTIONS.find((l) => l.code === filters.language);
			chips.push({
				key: 'language',
				label: `Language: ${lang?.name || filters.language}`,
				value: filters.language
			});
		}

		// Genres
		if (filters.genres && filters.genres.length > 0) {
			const genreMode = filters.genreMode || 'OR';
			const modeLabel = genreMode === 'AND' ? 'All of' : 'Any of';
			chips.push({
				key: 'genres',
				label: `${modeLabel}: ${filters.genres.join(', ')}`,
				value: filters.genres.join(',')
			});
		}

		return chips;
	});

	let hasActiveFilters = $derived(activeFilterChips.length > 0);

	function removeFilter(filterKey: keyof MovieFilters) {
		// Handle related filters
		if (filterKey === 'yearFrom') {
			onRemoveFilter('yearFrom');
			onRemoveFilter('yearTo');
		} else if (filterKey === 'runtimeMin') {
			onRemoveFilter('runtimeMin');
			onRemoveFilter('runtimeMax');
		} else {
			onRemoveFilter(filterKey);
		}
	}
</script>

{#if hasActiveFilters}
	<div class="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
		<span class="text-sm font-medium text-foreground">Active filters:</span>

		{#each activeFilterChips as chip}
			<Badge variant="secondary" class="gap-1.5 pr-1">
				{chip.label}
				<button
					onclick={() => removeFilter(chip.key)}
					class="ml-1 rounded-sm hover:bg-accent hover:text-accent-foreground"
					aria-label={`Remove ${chip.label} filter`}
				>
					<X class="h-3 w-3" />
				</button>
			</Badge>
		{/each}

		<Button variant="ghost" size="sm" onclick={onClearAll} class="ml-auto h-7 gap-1.5 text-xs">
			<X class="h-3 w-3" />
			Clear all
		</Button>
	</div>
{/if}
