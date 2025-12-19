<script lang="ts">
	import { ArrowUpDown } from '@lucide/svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { SortOptions } from '$lib/types/filters';

	interface Props {
		sort: SortOptions;
		onSortChange: (sort: SortOptions) => void;
	}

	let { sort, onSortChange }: Props = $props();

	const sortOptions: Array<{ value: SortOptions['field']; label: string }> = [
		{ value: 'popularity', label: 'Popularity' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'releaseDate', label: 'Release Date' },
		{ value: 'title', label: 'Title' },
		{ value: 'runtime', label: 'Runtime' }
	];

	const currentSortLabel = $derived(
		sortOptions.find((opt) => opt.value === sort.field)?.label || 'Popularity'
	);

	function handleFieldChange(field: string) {
		onSortChange({
			field: field as SortOptions['field'],
			order: sort.order
		});
	}

	function toggleOrder() {
		onSortChange({
			field: sort.field,
			order: sort.order === 'asc' ? 'desc' : 'asc'
		});
	}
</script>

<div class="flex items-center gap-2">
	<Select type="single" value={sort.field} onSelectedChange={(value) => value && handleFieldChange(value)}>
		<SelectTrigger class="w-[140px] cursor-pointer" aria-label="Sort by">
			<span class="flex items-center gap-2" data-slot="select-value">
				<ArrowUpDown class="size-4 text-muted-foreground" />
				{currentSortLabel}
			</span>
		</SelectTrigger>
		<SelectContent>
			{#each sortOptions as option}
				<SelectItem value={option.value}>{option.label}</SelectItem>
			{/each}
		</SelectContent>
	</Select>

	<button
		type="button"
		onclick={toggleOrder}
		class="flex size-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
		aria-label={sort.order === 'asc' ? 'Sort ascending' : 'Sort descending'}
		title={sort.order === 'asc' ? 'Sort ascending' : 'Sort descending'}
	>
		{#if sort.order === 'asc'}
			<svg
				class="size-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
			</svg>
		{:else}
			<svg
				class="size-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		{/if}
	</button>
</div>

