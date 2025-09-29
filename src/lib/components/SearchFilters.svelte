<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { SlidersHorizontal, RotateCcw } from '@lucide/svelte';
	import type { SortOption, QualityFilter } from '$lib/utils/searchUtils';

	let {
		sortBy,
		qualityFilter,
		onlyWithOverview,
		hasActiveFilters,
		onSortChange,
		onQualityChange,
		onResetFilters
	}: {
		sortBy: SortOption;
		qualityFilter: QualityFilter;
		onlyWithOverview: boolean;
		hasActiveFilters: boolean;
		onSortChange: (sort: SortOption) => void;
		onQualityChange: (quality: QualityFilter) => void;
		onResetFilters: () => void;
	} = $props();

	const sortOptions = [
		{ label: 'Best Match', value: 'relevance' as SortOption },
		{ label: 'Top Rated', value: 'rating' as SortOption },
		{ label: 'Newest', value: 'newest' as SortOption }
	];

	const qualityOptions = [
		{ label: 'Any Quality', value: 'any' as QualityFilter },
		{ label: 'HD & up', value: 'hd' as QualityFilter },
		{ label: '4K only', value: '4k' as QualityFilter }
	];

	const overviewSwitchId = 'search-overview-toggle';
</script>

<section class="space-y-5 rounded-2xl border border-border/50 bg-background/60 p-5 shadow-inner">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<span class="flex items-center gap-2 text-sm font-semibold text-foreground">
			<SlidersHorizontal class="size-4 text-muted-foreground" />
			Refine results
		</span>
		{#if hasActiveFilters}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-8 gap-1 self-start rounded-full px-3 text-xs text-muted-foreground hover:text-foreground md:self-auto"
				onclick={onResetFilters}
			>
				<RotateCcw class="size-3.5" />
				Reset filters
			</Button>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<div class="space-y-2">
			<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sort by</p>
			<div class="flex flex-wrap gap-2">
				{#each sortOptions as option (option.value)}
					<Button
						type="button"
						size="sm"
						variant={sortBy === option.value ? 'default' : 'outline'}
						class="h-8 rounded-full px-3 text-xs font-semibold"
						onclick={() => onSortChange(option.value)}
					>
						{option.label}
					</Button>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quality</p>
			<div class="flex flex-wrap gap-2">
				{#each qualityOptions as option (option.value)}
					<Button
						type="button"
						size="sm"
						variant={qualityFilter === option.value ? 'default' : 'outline'}
						class="h-8 rounded-full px-3 text-xs font-semibold"
						onclick={() => onQualityChange(option.value)}
					>
						{option.label}
					</Button>
				{/each}
			</div>
		</div>

		<div class="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 p-3">
			<Switch
				id={overviewSwitchId}
				bind:checked={onlyWithOverview}
				aria-describedby={`${overviewSwitchId}-description`}
			/>
			<div>
				<Label for={overviewSwitchId} class="cursor-pointer text-sm font-semibold text-foreground">
					Storyline only
				</Label>
				<p id={`${overviewSwitchId}-description`} class="text-xs text-muted-foreground">
					Hide titles without a synopsis so you can decide faster.
				</p>
			</div>
		</div>
	</div>
</section>
