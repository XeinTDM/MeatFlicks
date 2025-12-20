<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import ToggleGroup from '$lib/components/ui/toggle-group/ToggleGroup.svelte';
	import ToggleGroupItem from '$lib/components/ui/toggle-group/ToggleGroupItem.svelte';
	import { X, Check } from '@lucide/svelte';

	interface Props {
		selectedGenres: string[];
		genreMode: 'AND' | 'OR';
		availableGenres: Array<{ id: number; name: string }>;
		onGenresChange: (genres: string[]) => void;
		onGenreModeChange: (mode: 'AND' | 'OR') => void;
	}

	let { selectedGenres, genreMode, availableGenres, onGenresChange, onGenreModeChange }: Props =
		$props();

	function toggleGenre(genreName: string) {
		const isSelected = selectedGenres.includes(genreName);
		if (isSelected) {
			onGenresChange(selectedGenres.filter((g) => g !== genreName));
		} else {
			onGenresChange([...selectedGenres, genreName]);
		}
	}

	function clearGenres() {
		onGenresChange([]);
	}

	function isGenreSelected(genreName: string): boolean {
		return selectedGenres.includes(genreName);
	}
</script>

<div class="space-y-4">
	<!-- Selected genres display -->
	{#if selectedGenres.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			{#each selectedGenres as genre}
				<Badge variant="secondary" class="gap-1.5 pr-1">
					{genre}
					<button
						onclick={() => toggleGenre(genre)}
						class="ml-1 rounded-sm hover:bg-accent hover:text-accent-foreground"
						aria-label={`Remove ${genre}`}
					>
						<X class="h-3 w-3" />
					</button>
				</Badge>
			{/each}
			<Button variant="ghost" size="sm" onclick={clearGenres} class="h-6 text-xs">Clear all</Button>
		</div>
	{/if}

	<!-- Genre mode toggle (AND/OR) -->
	{#if selectedGenres.length > 1}
		<div class="flex items-center gap-2">
			<span class="text-xs text-muted-foreground">Match:</span>
			<ToggleGroup
				type="single"
				value={genreMode}
				onValueChange={(value) => onGenreModeChange(value as 'AND' | 'OR')}
			>
				<ToggleGroupItem value="OR" class="h-7 text-xs">Any</ToggleGroupItem>
				<ToggleGroupItem value="AND" class="h-7 text-xs">All</ToggleGroupItem>
			</ToggleGroup>
			<span class="text-xs text-muted-foreground">
				{genreMode === 'AND' ? 'Must have all selected genres' : 'Can have any selected genre'}
			</span>
		</div>
	{/if}

	<!-- Genre grid -->
	<div class="grid grid-cols-2 gap-2">
		{#each availableGenres as genre}
			{@const selected = isGenreSelected(genre.name)}
			<button
				onclick={() => toggleGenre(genre.name)}
				class="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors
					{selected
					? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
					: 'border-border bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				<span class="font-medium">{genre.name}</span>
				{#if selected}
					<Check class="h-4 w-4" />
				{/if}
			</button>
		{/each}
	</div>

	{#if availableGenres.length === 0}
		<p class="text-center text-sm text-muted-foreground">No genres available</p>
	{/if}
</div>
