<script lang="ts">
	import {
		CalendarDays,
		Filter,
		LayoutGrid,
		List,
		Search,
		Sparkles,
		Star,
		Trash2
	} from '@lucide/svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import MovieCard from '$lib/components/media/MovieCard.svelte';
	import type { Movie } from '$lib/state/stores/watchlistStore';
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '$lib/components/ui/alert-dialog';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';

	type WatchlistStats = {
		total: number;
		fourK: number;
		hd: number;
		runtimeMinutes: number;
		formattedRuntime: string;
		newestLabel: string;
	};

	type GroupedEntry = {
		key: string;
		label: string;
		date: Date;
		movies: Movie[];
	};

	const watchlistMovies = $derived($watchlist.watchlist ?? []);
	const error = $derived($watchlist.error);

	let searchTerm = $state('');
	let selectedGenre = $state('all');
	let selectedMediaType = $state<'all' | 'movie' | 'tv'>('all');
	let selectedQuality = $state<'all' | '4k' | 'hd'>('all');
	let minimumRating = $state('all');
	let sortOption = $state<'recent' | 'oldest' | 'alphabetical' | 'rating-desc' | 'release-desc'>(
		'recent'
	);
	let viewMode = $state<'grid' | 'list'>('grid');
	let toast = $state<{ message: string; variant: 'success' | 'error' } | null>(null);

	const numberFormatter = new Intl.NumberFormat('en-US');
	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	const sortLabels: Record<
		'recent' | 'oldest' | 'alphabetical' | 'rating-desc' | 'release-desc',
		string
	> = {
		recent: 'Newest first',
		oldest: 'Oldest first',
		alphabetical: 'A to Z',
		'rating-desc': 'Top rated',
		'release-desc': 'Latest releases'
	};

	function getGenreName(entry: unknown): string | null {
		if (typeof entry === 'string') {
			return entry;
		}
		if (
			entry &&
			typeof entry === 'object' &&
			'name' in entry &&
			typeof (entry as { name?: unknown }).name === 'string'
		) {
			return (entry as { name: string }).name;
		}
		return null;
	}

	const availableGenres = $derived(
		(() => {
			const values = new SvelteSet<string>();
			for (const movie of watchlistMovies) {
				const genres = movie.genres ?? [];
				for (const entry of genres) {
					const name = getGenreName(entry);
					if (name) {
						values.add(name);
					}
				}
			}
			return Array.from(values).sort((a, b) => a.localeCompare(b));
		})()
	);

	const stats = $derived(
		(() => {
			const total = watchlistMovies.length;
			let fourK = 0;
			let hd = 0;
			let runtimeMinutes = 0;
			const additions: Date[] = [];

			for (const movie of watchlistMovies) {
				if (movie.is4K) fourK += 1;
				if (movie.isHD || movie.is4K) hd += 1;
				if (typeof movie.durationMinutes === 'number' && Number.isFinite(movie.durationMinutes)) {
					runtimeMinutes += movie.durationMinutes;
				}
				const added = new Date(movie.addedAt ?? Date.now());
				if (!Number.isNaN(added.getTime())) {
					additions.push(added);
				}
			}

			const newest = additions.sort((a, b) => b.getTime() - a.getTime())[0];

			return {
				total,
				fourK,
				hd,
				runtimeMinutes,
				formattedRuntime: formatRuntime(runtimeMinutes),
				newestLabel: newest ? dateFormatter.format(newest) : 'N/A'
			} satisfies WatchlistStats;
		})()
	);

	const filteredMovies = $derived(
		(() => {
			return watchlistMovies.filter((movie) => {
				if (searchTerm.trim()) {
					const haystack = `${movie.title} ${movie.overview ?? ''}`.toLowerCase();
					if (!haystack.includes(searchTerm.trim().toLowerCase())) {
						return false;
					}
				}

				if (selectedGenre !== 'all') {
					const genres = movie.genres ?? [];
					const matchesGenre = genres.some((item) => {
						const name = getGenreName(item);
						return name ? name.toLowerCase() === selectedGenre.toLowerCase() : false;
					});

					if (!matchesGenre) {
						return false;
					}
				}

				if (selectedMediaType !== 'all') {
					const mediaType = movie.media_type ?? 'movie';
					if (mediaType.toLowerCase() !== selectedMediaType) {
						return false;
					}
				}

				if (selectedQuality === '4k' && !movie.is4K) {
					return false;
				}

				if (selectedQuality === 'hd' && !(movie.isHD || movie.is4K)) {
					return false;
				}

				if (minimumRating !== 'all') {
					const threshold = Number(minimumRating);
					if (!Number.isNaN(threshold) && (movie.rating ?? 0) < threshold) {
						return false;
					}
				}

				return true;
			});
		})()
	);

	const sortedMovies = $derived(
		(() => {
			const clone = [...filteredMovies];
			clone.sort((a, b) => {
				switch (sortOption) {
					case 'alphabetical':
						return a.title.localeCompare(b.title);
					case 'rating-desc':
						return (b.rating ?? 0) - (a.rating ?? 0);
					case 'release-desc':
						return new Date(b.releaseDate ?? 0).getTime() - new Date(a.releaseDate ?? 0).getTime();
					case 'oldest':
						return new Date(a.addedAt ?? 0).getTime() - new Date(b.addedAt ?? 0).getTime();
					case 'recent':
					default:
						return new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime();
				}
			});
			return clone;
		})()
	);

	const groupedByDate = $derived(
		(() => {
			const buckets = new SvelteMap<string, GroupedEntry>();

			for (const movie of sortedMovies) {
				const parsed = new Date(movie.addedAt ?? Date.now());
				const hasValidDate = !Number.isNaN(parsed.getTime());
				const normalized = hasValidDate
					? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
					: null;
				const key = normalized ? normalized.toISOString() : 'unknown';
				const label = normalized ? formatGroupLabel(normalized) : 'Undated';

				if (!buckets.has(key)) {
					buckets.set(key, { key, label, date: normalized ?? new Date(0), movies: [] });
				}

				buckets.get(key)!.movies.push(movie);
			}

			return Array.from(buckets.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
		})()
	);

	const activeFilters = $derived(
		(() => {
			const chips: string[] = [];
			if (searchTerm.trim()) chips.push(`Search: "${searchTerm.trim()}"`);
			if (selectedGenre !== 'all') chips.push(`Genre: ${selectedGenre}`);
			if (selectedMediaType !== 'all') chips.push(selectedMediaType === 'movie' ? 'Movies' : 'TV');
			if (selectedQuality === '4k') chips.push('Only 4K');
			if (selectedQuality === 'hd') chips.push('HD & 4K');
			if (minimumRating !== 'all') chips.push(`Rating >= ${minimumRating}`);
			if (sortOption !== 'recent') {
				chips.push(`Sort: ${sortLabels[sortOption]}`);
			}
			return chips;
		})()
	);

	function formatRuntime(totalMinutes: number): string {
		if (!totalMinutes || totalMinutes <= 0) {
			return 'N/A';
		}

		const minutesPerDay = 60 * 24;
		const days = Math.floor(totalMinutes / minutesPerDay);
		const hours = Math.floor((totalMinutes % minutesPerDay) / 60);
		const minutes = totalMinutes % 60;

		const parts: string[] = [];
		if (days) parts.push(`${days}d`);
		if (hours) parts.push(`${hours}h`);
		if (minutes && parts.length < 2) parts.push(`${minutes}m`);

		return parts.join(' ') || `${minutes}m`;
	}

	function formatGroupLabel(date: Date) {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today - ${dateFormatter.format(date)}`;
		}

		if (diffDays === 1) {
			return `Yesterday - ${dateFormatter.format(date)}`;
		}

		if (diffDays < 7 && diffDays > 1) {
			const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
			return `${weekday} - ${dateFormatter.format(date)}`;
		}

		return dateFormatter.format(date);
	}

	function resetFilters() {
		searchTerm = '';
		selectedGenre = 'all';
		selectedMediaType = 'all';
		selectedQuality = 'all';
		minimumRating = 'all';
		sortOption = 'recent';
	}

	async function exportWatchlist() {
		try {
			const payload = JSON.stringify(watchlist.exportData(), null, 2);
			await navigator.clipboard.writeText(payload);
			showToast('Watchlist copied to clipboard.');
		} catch (err) {
			console.error('[watchlist][export]', err);
			showToast('Failed to copy watchlist. Try again.', 'error');
		}
	}

	function removeFromWatchlist(id: string) {
		watchlist.removeFromWatchlist(id);
		showToast('Removed from watchlist.');
	}

	function handleClearWatchlist() {
		watchlist.clear();
		showToast('Watchlist cleared.');
	}

	function toggleView(mode: 'grid' | 'list') {
		viewMode = mode;
	}

	function showToast(message: string, variant: 'success' | 'error' = 'success') {
		toast = { message, variant };
		setTimeout(() => {
			if (toast?.message === message) {
				toast = null;
			}
		}, 3500);
	}
</script>

{#if error}
	<div class="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
		<p class="text-red-500">Error: {error}</p>
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<main class="container mx-auto space-y-8 px-4 py-8">
			<header
				class="flex flex-col gap-6 rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between"
			>
				<div class="space-y-2">
					<div class="flex items-center gap-3 text-muted-foreground">
						<Sparkles class="size-4" />
						<span class="text-sm tracking-wide uppercase">Personal queue</span>
					</div>
					<h1 class="text-4xl font-bold">My Watchlist</h1>
					<p class="text-muted-foreground">
						{stats.total > 0
							? `${numberFormatter.format(stats.total)} titles waiting - latest addition ${stats.newestLabel}`
							: 'Save shows and movies to keep them close at hand.'}
					</p>
					{#if activeFilters.length}
						<div class="flex flex-wrap gap-2">
							{#each activeFilters as chip (chip)}
								<Badge variant="secondary" class="bg-primary/10 text-primary">
									{chip}
								</Badge>
							{/each}
						</div>
					{/if}
				</div>
				<div class="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 md:grid-cols-4">
					<div class="rounded-lg border border-border bg-background/60 p-4">
						<p class="mb-1 flex items-center gap-2 font-semibold text-foreground">
							<Filter class="size-3" />
							Titles
						</p>
						<p class="text-2xl font-bold text-foreground">{numberFormatter.format(stats.total)}</p>
					</div>
					<div class="rounded-lg border border-border bg-background/60 p-4">
						<p class="mb-1 flex items-center gap-2 font-semibold text-foreground">
							<CalendarDays class="size-3" />
							Runtime
						</p>
						<p class="text-2xl font-bold text-foreground">{stats.formattedRuntime}</p>
					</div>
				</div>
			</header>

			<section
				class="flex flex-col gap-4 rounded-2xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur"
			>
				<div class="grid gap-4 lg:grid-cols-12">
					<div class="lg:col-span-4">
						<div
							class="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3"
						>
							<Search class="size-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Search title or synopsis..."
								bind:value={searchTerm}
								class="border-0 bg-transparent focus-visible:ring-0"
							/>
						</div>
					</div>
					<div class="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
						<Select type="single" bind:value={selectedGenre}>
							<SelectTrigger aria-label="Filter by genre">
								<span data-slot="select-value">
									{selectedGenre === 'all' ? 'All genres' : selectedGenre}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All genres</SelectItem>
								{#if availableGenres.length === 0}
									<SelectItem value="_empty" disabled>No genres available</SelectItem>
								{:else}
									{#each availableGenres as genre (genre)}
										<SelectItem value={genre}>{genre}</SelectItem>
									{/each}
								{/if}
							</SelectContent>
						</Select>

						<Select type="single" bind:value={selectedMediaType}>
							<SelectTrigger aria-label="Filter by type">
								<span data-slot="select-value">
									{selectedMediaType === 'movie'
										? 'Movies only'
										: selectedMediaType === 'tv'
											? 'TV only'
											: 'Movies & TV'}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Movies & TV</SelectItem>
								<SelectItem value="movie">Movies only</SelectItem>
								<SelectItem value="tv">TV only</SelectItem>
							</SelectContent>
						</Select>

						<Select type="single" bind:value={selectedQuality}>
							<SelectTrigger aria-label="Filter by quality">
								<span data-slot="select-value">
									{selectedQuality === '4k'
										? '4K only'
										: selectedQuality === 'hd'
											? 'HD & 4K'
											: 'Any quality'}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Any quality</SelectItem>
								<SelectItem value="4k">4K only</SelectItem>
								<SelectItem value="hd">HD & 4K</SelectItem>
							</SelectContent>
						</Select>

						<Select type="single" bind:value={minimumRating}>
							<SelectTrigger aria-label="Filter by rating">
								<span data-slot="select-value">
									{minimumRating === 'all' ? 'All ratings' : `Rating >= ${minimumRating}`}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All ratings</SelectItem>
								<SelectItem value="5">5.0+</SelectItem>
								<SelectItem value="6">6.0+</SelectItem>
								<SelectItem value="7">7.0+</SelectItem>
								<SelectItem value="8">8.0+</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<Button
							type="button"
							variant={viewMode === 'grid' ? 'default' : 'secondary'}
							size="icon"
							aria-label="Grid view"
							class="rounded-full"
							onclick={() => toggleView('grid')}
						>
							<LayoutGrid class="size-4" />
						</Button>
						<Button
							type="button"
							variant={viewMode === 'list' ? 'default' : 'secondary'}
							size="icon"
							aria-label="List view"
							class="rounded-full"
							onclick={() => toggleView('list')}
						>
							<List class="size-4" />
						</Button>

						<Select type="single" bind:value={sortOption}>
							<SelectTrigger class="w-44" aria-label="Sort watchlist">
								<span data-slot="select-value">{sortLabels[sortOption]}</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="recent">Newest first</SelectItem>
								<SelectItem value="oldest">Oldest first</SelectItem>
								<SelectItem value="alphabetical">A to Z</SelectItem>
								<SelectItem value="rating-desc">Top rated</SelectItem>
								<SelectItem value="release-desc">Latest releases</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<Button type="button" variant="ghost" onclick={resetFilters}>Clear filters</Button>
						<Button type="button" variant="secondary" onclick={exportWatchlist}>Export list</Button>
						<AlertDialog>
							<AlertDialogTrigger
								type="button"
								class={`${buttonVariants({ variant: 'destructive' })} flex items-center gap-2`}
							>
								<Trash2 class="mr-2 size-4" />
								Clear watchlist
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Clear watchlist?</AlertDialogTitle>
									<AlertDialogDescription>
										This will remove every title from your watchlist. You cannot undo this action.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onclick={handleClearWatchlist}>Clear</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			</section>

			{#if sortedMovies.length === 0}
				<section
					class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-16 text-center text-muted-foreground"
				>
					<CalendarDays class="mb-4 size-10" />
					<h2 class="mb-2 text-2xl font-semibold text-foreground">Nothing to watch yet</h2>
					<p class="mb-6 max-w-md text-sm">
						Use the explore and search tabs to add titles to your watchlist. Filter controls above
						will help you keep things organised as your queue grows.
					</p>
					<div class="flex flex-wrap items-center justify-center gap-3 text-xs">
						<Badge variant="secondary" class="tracking-wide uppercase">Tip</Badge>
						<span>Use the heart icon on any title card to save it fast.</span>
					</div>
				</section>
			{:else}
				<section class="space-y-10">
					{#each groupedByDate as group (group.key)}
						<div class="space-y-5">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 class="text-2xl font-semibold text-foreground">{group.label}</h2>
									<p class="text-sm text-muted-foreground">
										{group.movies.length} title{group.movies.length === 1 ? '' : 's'} added
									</p>
								</div>
								{#if group.date.getTime() > 0}
									<Badge variant="outline" class="border-border bg-background/60">
										Added on {dateFormatter.format(group.date)}
									</Badge>
								{/if}
							</div>

							{#if viewMode === 'grid'}
								<div
									class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
								>
									{#each group.movies as movie (movie.id)}
										<MovieCard {movie} />
									{/each}
								</div>
							{:else}
								<div class="space-y-3">
									{#each group.movies as movie (movie.id)}
										<article
											class="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-sm transition hover:border-primary/50 md:flex-row md:items-center"
										>
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a
												rel="external"
												href={`/${movie.canonicalPath ?? `movie/${movie.id}`}`}
												data-sveltekit-preload-data="hover"
												class="flex w-full gap-4 md:w-auto"
											>
												{#if movie.posterPath}
													<img
														src={movie.posterPath}
														alt={`Poster for ${movie.title}`}
														width="96"
														height="144"
														class="h-36 w-24 rounded-lg object-cover shadow"
													/>
												{:else}
													<div
														class="flex h-36 w-24 items-center justify-center rounded-lg bg-muted text-muted-foreground"
													>
														<span class="text-xs">No artwork</span>
													</div>
												{/if}
											</a>
											<div class="flex flex-1 flex-col gap-3">
												<div class="flex flex-wrap items-start justify-between gap-2">
													<div class="space-y-1">
														<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
														<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
														<a
															rel="external"
															href={`/${movie.canonicalPath ?? `movie/${movie.id}`}`}
															data-sveltekit-preload-data="hover"
															class="text-lg font-semibold hover:text-primary"
														>
															{movie.title}
														</a>
														<div
															class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
														>
															<span class="flex items-center gap-1">
																<CalendarDays class="size-3" />
																{movie.releaseDate
																	? new Date(movie.releaseDate).getFullYear()
																	: 'N/A'}
															</span>
															<span class="flex items-center gap-1">
																<Star class="size-3 text-yellow-400" />
																{Number.isFinite(movie.rating) && movie.rating > 0
																	? movie.rating.toFixed(1)
																	: 'NR'}
															</span>
															<span>
																{(movie.genres ?? [])
																	.slice(0, 3)
																	.map((item) => getGenreName(item))
																	.filter((name): name is string => Boolean(name))
																	.join(' · ') || 'Uncategorised'}
															</span>
														</div>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="text-muted-foreground"
														onclick={() => removeFromWatchlist(movie.id)}
														aria-label={`Remove ${movie.title} from watchlist`}
													>
														<Trash2 class="size-4" />
													</Button>
												</div>
												<p class="line-clamp-3 text-sm text-muted-foreground">
													{movie.overview ?? 'No synopsis available.'}
												</p>
												<div class="flex flex-wrap items-center gap-2 text-xs">
													{#if movie.is4K}
														<Badge variant="secondary" class="bg-red-500/20 text-red-200">4K</Badge>
													{:else if movie.isHD}
														<Badge variant="secondary" class="bg-blue-500/20 text-blue-200"
															>HD</Badge
														>
													{/if}
													{#if movie.media_type === 'tv'}
														<Badge variant="outline">TV series</Badge>
													{:else}
														<Badge variant="outline">Movie</Badge>
													{/if}
													<Badge variant="outline">
														Added {new Date(movie.addedAt ?? Date.now()).toLocaleDateString()}
													</Badge>
												</div>
											</div>
										</article>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</section>
			{/if}
		</main>

		{#if toast}
			<div class="fixed right-6 bottom-6 z-50 w-80">
				<Alert
					class={`border ${toast.variant === 'success' ? 'border-emerald-500/60 bg-emerald-900/40 text-emerald-100' : 'border-destructive/60 bg-destructive/10 text-destructive'}`}
				>
					<AlertTitle>{toast.variant === 'success' ? 'Success' : 'Heads up'}</AlertTitle>
					<AlertDescription>{toast.message}</AlertDescription>
				</Alert>
			</div>
		{/if}
	</div>
{/if}
