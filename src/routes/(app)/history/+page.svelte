<script lang="ts">
	import CarouselContainer from '$lib/components/home/CarouselContainer.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import type { HistoryEntry } from '$lib/state/stores/historyStore';
	import type { PageData } from './$types';
	import { Funnel, RefreshCw, Star } from '@lucide/svelte';

	let { data } = $props<{ data: PageData }>();

	const collectionTitle = $derived(data.collectionTitle);
	const movies = $derived(data.movies);
	const hasContent = $derived(data.hasContent);

	type NormalizedHistoryEntry = HistoryEntry & {
		normalizedType: string;
		watchedAtDate: Date | null;
		sortValue: number;
		releaseYear: number | null;
	};

	let searchTerm = $state('');
	let mediaTypeFilter = $state<string>('all');

	const historyState = $derived($watchHistory);
	const historyEntries = $derived(historyState.entries);
	const historyError = $derived(historyState.error);

	const normalizedEntries = $derived.by<NormalizedHistoryEntry[]>(() =>
		historyEntries.map((entry) => {
			const watchedAtCandidate = new Date(entry.watchedAt);
			const watchedAtTime = watchedAtCandidate.getTime();
			const watchedAtDate = Number.isNaN(watchedAtTime) ? null : watchedAtCandidate;

			const releaseDateCandidate = entry.releaseDate ? new Date(entry.releaseDate) : null;
			const releaseYearValue = releaseDateCandidate ? releaseDateCandidate.getFullYear() : NaN;
			const releaseYear = Number.isNaN(releaseYearValue) ? null : releaseYearValue;

			return {
				...entry,
				normalizedType: (entry.mediaType ?? 'unknown').toLowerCase(),
				watchedAtDate,
				sortValue: watchedAtDate ? watchedAtDate.getTime() : 0,
				releaseYear
			} satisfies NormalizedHistoryEntry;
		})
	);

	const countsByType = $derived.by<Record<string, number>>(() => {
		const counts: Record<string, number> = {};

		for (const entry of normalizedEntries) {
			counts[entry.normalizedType] = (counts[entry.normalizedType] ?? 0) + 1;
		}

		return counts;
	});

	const mediaLabels: Record<string, string> = {
		all: 'All',
		movie: 'Movies',
		tv: 'TV Series',
		'tv-shows': 'TV Shows',
		anime: 'Anime',
		manga: 'Manga',
		unknown: 'Unknown'
	};

	const toMediaLabel = (value: string) => {
		const normalized = value.toLowerCase();

		if (mediaLabels[normalized]) {
			return mediaLabels[normalized];
		}

		return normalized
			.split(/[-_ ]+/)
			.filter(Boolean)
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(' ');
	};

	const availableFilters = $derived.by(() => {
		const unique = new SvelteSet<string>();

		for (const entry of normalizedEntries) {
			unique.add(entry.normalizedType);
		}

		return [
			'all',
			...Array.from(unique).sort((a, b) => toMediaLabel(a).localeCompare(toMediaLabel(b)))
		];
	});

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	type RelativeDivision = {
		amount: number;
		unit: Intl.RelativeTimeFormatUnit;
	};

	const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const relativeDivisions: RelativeDivision[] = [
		{ amount: 60, unit: 'second' },
		{ amount: 60, unit: 'minute' },
		{ amount: 24, unit: 'hour' },
		{ amount: 7, unit: 'day' },
		{ amount: 4.34524, unit: 'week' },
		{ amount: 12, unit: 'month' },
		{ amount: Number.POSITIVE_INFINITY, unit: 'year' }
	];

	const formatWatchedAt = (date: Date | null) =>
		date ? dateFormatter.format(date) : 'Unknown watch time';

	const formatRelativeTime = (date: Date | null) => {
		if (!date) return null;

		let duration = (date.getTime() - Date.now()) / 1000;

		for (const division of relativeDivisions) {
			if (Math.abs(duration) < division.amount) {
				return relativeFormatter.format(Math.round(duration), division.unit);
			}

			duration /= division.amount;
		}

		return null;
	};

	const filteredEntries = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();

		return normalizedEntries
			.filter((entry) => mediaTypeFilter === 'all' || entry.normalizedType === mediaTypeFilter)
			.filter((entry) => {
				if (!term) return true;

				const haystack =
					`${entry.title} ${entry.overview ?? ''} ${entry.genres.join(' ')}`.toLowerCase();
				return haystack.includes(term);
			})
			.sort((a, b) => b.sortValue - a.sortValue);
	});

	const filterCount = (value: string) =>
		value === 'all' ? normalizedEntries.length : (countsByType[value] ?? 0);

	const hasActiveFilters = $derived(mediaTypeFilter !== 'all' || searchTerm.trim().length > 0);

	const resetFilters = () => {
		searchTerm = '';
		mediaTypeFilter = 'all';
	};
</script>

<div class="min-h-screen bg-background text-foreground">
	<main class="container mx-auto space-y-6 px-4 py-8">
		<header class="space-y-2">
			<h1 class="text-3xl font-semibold sm:text-4xl">Watch History</h1>
			<p class="text-muted-foreground">
				Review everything you've watched and revisit favourites with detailed context.
			</p>
		</header>

		<Card class="border-border bg-background/60 backdrop-blur">
			<CardHeader class="space-y-1">
				<div class="flex items-center justify-between gap-2">
					<CardTitle class="flex items-center gap-2 text-lg font-semibold">
						<Funnel class="size-4" />
						Filters
					</CardTitle>
					<Badge variant="outline" class="gap-1">
						<span>{filteredEntries.length}</span>
						<span class="text-muted-foreground">/ {normalizedEntries.length}</span>
					</Badge>
				</div>
				<CardDescription>Refine your watch history by title, genre, or media type.</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
					<Input
						type="search"
						autocomplete="off"
						placeholder="Search by title, genre, or description..."
						class="bg-transparent"
						value={searchTerm}
						oninput={(event) => (searchTerm = event.currentTarget.value)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="justify-start gap-2 md:justify-end"
						onclick={resetFilters}
						disabled={!hasActiveFilters}
					>
						<RefreshCw class="size-4" />
						Reset filters
					</Button>
				</div>

				<div class="flex flex-wrap gap-2">
					{#each availableFilters as option (option)}
						<Button
							type="button"
							size="sm"
							variant={mediaTypeFilter === option ? 'default' : 'outline'}
							class="gap-2"
							onclick={() => (mediaTypeFilter = option)}
						>
							{toMediaLabel(option)}
							<Badge
								variant={mediaTypeFilter === option ? 'secondary' : 'outline'}
								class="pointer-events-none"
							>
								{filterCount(option)}
							</Badge>
						</Button>
					{/each}
				</div>
			</CardContent>
		</Card>

		{#if historyError}
			<Card class="border-destructive/50 bg-destructive/10 text-destructive">
				<CardContent class="p-6">
					<h2 class="text-lg font-semibold">Unable to load history</h2>
					<p class="mt-2 text-sm">
						{historyError}
					</p>
				</CardContent>
			</Card>
		{:else if normalizedEntries.length === 0}
			<Card class="border-border bg-background/60 backdrop-blur">
				<CardContent class="space-y-4 p-6 text-center">
					<h2 class="text-xl font-semibold">No watch history yet</h2>
					<p class="text-sm text-muted-foreground">
						Start watching something and your history will appear here automatically.
					</p>
					<Button
						type="button"
						variant="secondary"
						class="mx-auto w-fit"
						href="/(app)/explore/movies"
					>
						Browse titles
					</Button>
				</CardContent>
			</Card>

			{#if hasContent}
				<Separator class="my-6" />
				<CarouselContainer title={collectionTitle} {movies} />
			{/if}
		{:else if filteredEntries.length === 0}
			<Card class="border-border bg-background/60 backdrop-blur">
				<CardContent class="space-y-4 p-6 text-center">
					<h2 class="text-xl font-semibold">No matches found</h2>
					<p class="text-sm text-muted-foreground">
						Try adjusting your search or selecting a different filter to continue exploring.
					</p>
					<Button
						type="button"
						variant="outline"
						class="mx-auto w-fit gap-2"
						onclick={resetFilters}
					>
						<RefreshCw class="size-4" />
						Clear filters
					</Button>
				</CardContent>
			</Card>
		{:else}
			<section class="space-y-4">
				{#each filteredEntries as entry (entry.id + entry.watchedAt)}
					{@const relativeLabel = formatRelativeTime(entry.watchedAtDate)}
					<Card class="border-border bg-background/70 transition-colors hover:border-primary/60">
						<CardContent class="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
							<div class="relative h-48 w-full overflow-hidden rounded-lg bg-muted sm:w-32">
								{#if entry.posterPath}
									<img
										src={entry.posterPath}
										alt={`${entry.title} poster`}
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center text-xs tracking-wide text-muted-foreground uppercase"
									>
										No artwork
									</div>
								{/if}
							</div>

							<div class="flex-1 space-y-3">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-xl font-semibold">{entry.title}</h2>
									<Badge variant="secondary">{toMediaLabel(entry.normalizedType)}</Badge>
									{#if entry.rating > 0}
										<Badge variant="outline" class="gap-1">
											<Star class="size-3.5 text-amber-400" />
											{entry.rating.toFixed(1)}
										</Badge>
									{/if}
								</div>

								<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
									<span>{formatWatchedAt(entry.watchedAtDate)}</span>
									{#if relativeLabel}
										<span aria-hidden="true">&middot;</span>
										<span>{relativeLabel}</span>
									{/if}
									{#if entry.releaseYear}
										<span aria-hidden="true">&middot;</span>
										<span>Released {entry.releaseYear}</span>
									{/if}
								</div>

								{#if entry.genres.length > 0}
									<div class="flex flex-wrap gap-1.5">
										{#each entry.genres.slice(0, 6) as genre (genre)}
											<Badge variant="outline" class="bg-transparent">
												{genre}
											</Badge>
										{/each}
									</div>
								{/if}

								{#if entry.overview}
									<p class="max-w-prose text-sm leading-relaxed text-muted-foreground">
										{entry.overview}
									</p>
								{/if}
							</div>
						</CardContent>
					</Card>
				{/each}
			</section>
		{/if}
	</main>
</div>
