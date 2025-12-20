<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { SlidersHorizontal, RotateCcw, Users, Film } from '@lucide/svelte';
	import type { SortOption, QualityFilter } from '$lib/utils/searchUtils';
	import PersonSearch from './PersonSearch.svelte';

	interface PersonSearchResult {
		id: number;
		tmdbId: number;
		name: string;
		profilePath: string | null;
		knownForDepartment: string | null;
		popularity: number;
		biography?: string;
		birthday?: string;
		placeOfBirth?: string;
	}

	interface Props {
		sortBy: SortOption;
		qualityFilter: QualityFilter;
		onlyWithOverview: boolean;
		selectedActors?: PersonSearchResult[];
		selectedDirectors?: PersonSearchResult[];
		hasActiveFilters: boolean;
		onSortChange: (sort: SortOption) => void;
		onQualityChange: (quality: QualityFilter) => void;
		onOverviewToggle: (enabled: boolean) => void;
		onActorsChange: (actors: PersonSearchResult[]) => void;
		onDirectorsChange: (directors: PersonSearchResult[]) => void;
		onResetFilters: () => void;
	}

	let {
		sortBy,
		qualityFilter,
		onlyWithOverview,
		selectedActors = [],
		selectedDirectors = [],
		hasActiveFilters,
		onSortChange,
		onQualityChange,
		onOverviewToggle,
		onActorsChange,
		onDirectorsChange,
		onResetFilters
	}: Props = $props();

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
	const overviewDescriptionId = `${overviewSwitchId}-description`;

	let overviewSelection = $state(onlyWithOverview);
	let actors = $state(selectedActors);
	let directors = $state(selectedDirectors);

	$effect(() => {
		overviewSelection = onlyWithOverview;
	});

	$effect(() => {
		if (overviewSelection !== onlyWithOverview) {
			onOverviewToggle(overviewSelection);
		}
	});

	$effect(() => {
		if (actors !== selectedActors) {
			onActorsChange(actors);
		}
	});

	$effect(() => {
		if (directors !== selectedDirectors) {
			onDirectorsChange(directors);
		}
	});

	function handleActorSelect(actor: PersonSearchResult) {
		actors = [...actors, actor];
	}

	function handleActorRemove(actor: PersonSearchResult) {
		actors = actors.filter(a => a.id !== actor.id);
	}

	function handleDirectorSelect(director: PersonSearchResult) {
		directors = [...directors, director];
	}

	function handleDirectorRemove(director: PersonSearchResult) {
		directors = directors.filter(d => d.id !== director.id);
	}
</script>

<section class="space-y-5 rounded-2xl border border-border/50 bg-background/60 p-5 shadow-inner">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<span class="flex items-center gap-2 text-sm font-semibold text-foreground">
			<SlidersHorizontal class="size-4 text-muted-foreground" />
			Advanced Search
		</span>
		{#if hasActiveFilters}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-8 gap-1 self-start rounded-full px-3 text-xs text-muted-foreground hover:text-foreground md:self-auto"
				onclick={() => onResetFilters()}
			>
				<RotateCcw class="size-3.5" />
				Reset filters
			</Button>
		{/if}
	</div>

	<div class="grid gap-6 xl:grid-cols-2">
		<!-- People Search Section -->
		<div class="space-y-4 xl:col-span-2">
			<div class="grid gap-4 sm:grid-cols-2">
				<!-- Actors -->
				<div class="space-y-2">
					<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1">
						<Users class="size-3" />
						Actors
					</p>
					<PersonSearch
						placeholder="Search for actors..."
						selectedPeople={actors}
						onpersonselect={handleActorSelect}
						onpersonremove={handleActorRemove}
					/>
				</div>

				<!-- Directors -->
				<div class="space-y-2">
					<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1">
						<Film class="size-3" />
						Directors
					</p>
					<PersonSearch
						placeholder="Search for directors..."
						selectedPeople={directors}
						onpersonselect={handleDirectorSelect}
						onpersonremove={handleDirectorRemove}
					/>
				</div>
			</div>
		</div>

		<!-- Sort and Quality Section -->
		<div class="space-y-4">
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
		</div>

		<!-- Metadata Section -->
		<div class="space-y-2">
			<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Metadata</p>
			<div
				class="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-3"
			>
				<div class="space-y-1">
					<Label for={overviewSwitchId} class="text-xs font-semibold text-foreground">
						Require overview
					</Label>
					<p id={overviewDescriptionId} class="text-xs leading-snug text-muted-foreground">
						Hide titles without a synopsis.
					</p>
				</div>
				<Switch
					id={overviewSwitchId}
					aria-describedby={overviewDescriptionId}
					bind:checked={overviewSelection}
				/>
			</div>
		</div>
	</div>
</section>
