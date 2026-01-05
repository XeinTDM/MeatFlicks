<script lang="ts">
	import Hero from '$lib/components/home/Hero.svelte';
	import { PersonalizedRows } from '$lib/components/home';
	import { MediaScrollContainer } from '$lib/components/media';
	import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
	import type { PageData } from './$types';
	import type { HomeLibrary } from '$lib/types/library';
	import { SEOHead } from '$lib/components/seo';
	import { useLazyComponentOnVisible } from '$lib/utils/lazyLoad.svelte.ts';

	let continueWatchingRef = $state({ value: null as HTMLElement | null });
	let trendingMoviesRef = $state({ value: null as HTMLElement | null });
	let trendingTvRef = $state({ value: null as HTMLElement | null });
	let recentlyAddedRef = $state({ value: null as HTMLElement | null });
	let topRatedRef = $state({ value: null as HTMLElement | null });

	const continueWatchingLazy = useLazyComponentOnVisible(
		continueWatchingRef,
		() => import('$lib/components/home/ContinueWatchingRow.svelte')
	);

	const trendingLazy = useLazyComponentOnVisible(
		trendingMoviesRef,
		() => import('$lib/components/home/TrendingMoviesSlider.svelte')
	);

	const recentlyAddedLazy = useLazyComponentOnVisible(
		recentlyAddedRef,
		() => import('$lib/components/home/RecentlyAddedRow.svelte')
	);

	const topRatedLazy = useLazyComponentOnVisible(
		topRatedRef,
		() => import('$lib/components/home/TopRatedRow.svelte')
	);

	const ContinueWatchingRow = $derived(continueWatchingLazy.component);
	const TrendingMoviesSlider = $derived(trendingLazy.component);
	const RecentlyAddedRow = $derived(recentlyAddedLazy.component);
	const TopRatedRow = $derived(topRatedLazy.component);

	let { data }: { data: PageData } = $props();

	let refreshPromise = $state<Promise<HomeLibrary | null> | null>(null);
	const homeLibraryPromise = $derived(
		refreshPromise ?? (data.streamed?.homeLibrary as Promise<HomeLibrary | null>) ?? null
	);
	let isRefreshing = $state(false);
	let refreshError = $state<string | null>(null);
	let lastResolvedLibrary = $state<HomeLibrary | null>(null);
	let activePromise: Promise<HomeLibrary | null> | null = null;

	async function refreshHomeLibrary() {
		if (isRefreshing) return;
		isRefreshing = true;
		refreshError = null;

		const loadPromise = (async () => {
			const response = await fetch('/api/home-library/refresh', { method: 'POST' });
			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || 'Unable to refresh spotlight.');
			}

			const payload = (await response.json()) as {
				success: boolean;
				data: HomeLibrary | null;
				error?: string;
			};
			if (!payload.success || !payload.data) {
				throw new Error(payload.error ?? 'No spotlight data returned.');
			}

			lastResolvedLibrary = payload.data;
			return payload.data;
		})();

		refreshPromise = loadPromise;

		try {
			await loadPromise;
		} catch (error) {
			console.error('Failed to refresh home library data', error);
			refreshError = error instanceof Error ? error.message : 'Failed to refresh spotlight.';
			if (lastResolvedLibrary) {
				refreshPromise = Promise.resolve(lastResolvedLibrary);
			}
		} finally {
			isRefreshing = false;
		}
	}

	$effect(() => {
		// Reset manual refresh promise when page data changes (navigation)
		data;
		refreshPromise = null;
	});
	$effect(() => {
		const promise = homeLibraryPromise;
		if (!promise) {
			return;
		}

		const current = promise;
		activePromise = current;
		current
			.then((value) => {
				if (activePromise !== current) return;
				if (value) {
					lastResolvedLibrary = value;
				}
			})
			.catch(() => undefined);
	});
</script>

<SEOHead
	title="MeatFlicks - Your Ultimate Free Streaming Platform"
	description="Discover and stream your favorite movies and TV shows for free on MeatFlicks. Watch trending content, explore collections, and enjoy unlimited entertainment."
	canonical="/"
	ogType="website"
	keywords={[
		'free movies',
		'free TV shows',
		'streaming',
		'watch online',
		'movies online',
		'TV series',
		'entertainment'
	]}
/>

<div class="min-h-screen text-foreground">
	<div class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
		<main
			class="flex min-h-[calc(100vh-2rem)] flex-col gap-12 overflow-hidden rounded-lg bg-card/80 shadow-xl backdrop-blur"
		>
			{#if homeLibraryPromise}
				{#await homeLibraryPromise}
					<HomePageSkeleton />
				{:then resolved}
					{#if !resolved}
						<HomePageSkeleton />
					{:else}
						{@const library = resolved}
						{@const trendingMovies = Array.isArray(library?.trendingMovies)
							? library.trendingMovies
							: []}
						{@const trendingTv = Array.isArray(library?.trendingTv) ? library.trendingTv : []}
						{@const collections = Array.isArray(library?.collections) ? library.collections : []}
						{@const genres = Array.isArray(library?.genres) ? library.genres : []}
						{@const featuredMovie = trendingMovies.at(0) ?? null}

						<Hero
							movie={featuredMovie}
							movies={trendingMovies}
							onRefresh={refreshHomeLibrary}
							refreshing={isRefreshing}
						/>

						{#if refreshError}
							<p class="px-[5%] text-sm text-destructive sm:px-5">{refreshError}</p>
						{/if}

						<div class="p-6 sm:p-5 lg:p-5">
							<div class="mb-12">
								{#if ContinueWatchingRow}
									<ContinueWatchingRow />
								{:else}
									<div
										bind:this={continueWatchingRef.value}
										class="h-32 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
								<PersonalizedRows />
							</div>

							{#if trendingMovies.length > 0}
								{#if TrendingMoviesSlider}
									<TrendingMoviesSlider title="Trending Movies" movies={trendingMovies} />
								{:else}
									<div
										bind:this={trendingMoviesRef.value}
										class="h-48 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
							{/if}

							{#if trendingTv.length > 0}
								{#if TrendingMoviesSlider}
									<TrendingMoviesSlider title="Trending TV Series" movies={trendingTv} />
								{:else}
									<div
										bind:this={trendingTvRef.value}
										class="h-48 animate-pulse rounded-lg bg-muted/50"
									></div>
								{/if}
							{/if}

							{#if RecentlyAddedRow}
								<RecentlyAddedRow />
							{:else}
								<div
									bind:this={recentlyAddedRef.value}
									class="h-48 animate-pulse rounded-lg bg-muted/50"
								></div>
							{/if}

							{#if TopRatedRow}
								<TopRatedRow />
							{:else}
								<div
									bind:this={topRatedRef.value}
									class="h-48 animate-pulse rounded-lg bg-muted/50"
								></div>
							{/if}

							{#if trendingMovies.length === 0 && collections.length === 0 && genres.length === 0}
								<p class="text-sm text-foreground/70">
									No movies available yet. Try refreshing the library.
								</p>
							{/if}

							{#each collections as collection (collection.id)}
								{#if Array.isArray(collection.movies) && collection.movies.length > 0}
									<MediaScrollContainer
										title={collection.name}
										movies={collection.movies}
										linkTo={`/collection/${collection.slug}`}
									/>
								{/if}
							{/each}

							{#each genres as genre (genre.id)}
								{#if Array.isArray(genre.movies) && genre.movies.length > 0}
									<MediaScrollContainer
										title={genre.name}
										movies={genre.movies}
										linkTo={`/genre/${genre.slug}`}
									/>
								{/if}
							{/each}
						</div>
					{/if}
				{:catch}
					<HomePageSkeleton />
				{/await}
			{:else}
				<HomePageSkeleton />
			{/if}
		</main>
	</div>
</div>
