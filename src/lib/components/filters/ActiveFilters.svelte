<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { X } from '@lucide/svelte';
	import type { MovieFilters } from '$lib/types/filters';
	import { LANGUAGE_OPTIONS } from '$lib/types/filters';

	interface Props {
		filters: MovieFilters;
		mediaType?: 'movie' | 'tv' | 'anime';
		onRemove: (updates: Partial<MovieFilters> & { mediaType?: undefined }) => void;
	}

	let { filters, mediaType, onRemove }: Props = $props();

	interface FilterChip {
		key: keyof MovieFilters | 'mediaType';
		label: string;
		value: string;
	}

	let activeFilterChips = $state<FilterChip[]>([]);

	$effect(() => {
		const chips: FilterChip[] = [];

		if (mediaType) {
			chips.push({
				key: 'mediaType',
				label: `Type: ${mediaType === 'tv' ? 'TV' : mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`,
				value: mediaType
			});
		}

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

		if (filters.minRating !== undefined) {
			chips.push({
				key: 'minRating',
				label: `Rating: ${filters.minRating}+`,
				value: filters.minRating.toString()
			});
		}

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

		if (filters.language) {
			const lang = LANGUAGE_OPTIONS.find((l) => l.code === filters.language);
			chips.push({
				key: 'language',
				label: `Language: ${lang?.name || filters.language}`,
				value: filters.language
			});
		}

		if (filters.genres && filters.genres.length > 0) {
			const genreMode = filters.genreMode || 'OR';
			const modeLabel = genreMode === 'AND' ? 'All of' : 'Any of';
			chips.push({
				key: 'genres',
				label: `${modeLabel}: ${filters.genres.join(', ')}`,
				value: filters.genres.join(',')
			});
		}

		activeFilterChips = chips;
	});

	let hasActiveFilters = $derived(activeFilterChips.length > 0);

	function removeFilter(filterKey: keyof MovieFilters | 'mediaType') {
		if (filterKey === 'mediaType') {
			onRemove({ mediaType: undefined } as any);
		} else if (filterKey === 'yearFrom') {
			onRemove({ yearFrom: undefined, yearTo: undefined });
		} else if (filterKey === 'runtimeMin') {
			onRemove({ runtimeMin: undefined, runtimeMax: undefined });
		} else if (filterKey === 'genres') {
			onRemove({ genres: [] });
		} else {
			onRemove({ [filterKey]: undefined });
		}
	}

	function clearAll() {
		onRemove({
			genres: [],
			minRating: undefined,
			maxRating: undefined,
			yearFrom: undefined,
			yearTo: undefined,
			runtimeMin: undefined,
			runtimeMax: undefined,
			language: undefined,
			mediaType: undefined
		} as any);
	}
</script>

{#if hasActiveFilters}
	<div class="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
		<span class="text-sm font-medium text-foreground">Active filters:</span>

		{#each activeFilterChips as chip (chip.key + chip.value)}
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

		<Button variant="ghost" size="sm" onclick={clearAll} class="ml-auto h-7 gap-1.5 text-xs">
			<X class="h-3 w-3" />
			Clear all
		</Button>
	</div>
{/if}
