<script lang="ts">
	import Hero from '$lib/components/Hero.svelte';
	import { TrendingMoviesSlider, MovieScrollContainer, PersonalizedRows } from '$lib/components';
	import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
	import type { PageData } from './$types';
	import type { HomeLibrary } from '$lib/types/library';

	let { data }: { data: PageData } = $props();

	let homeLibraryPromise = $state<Promise<HomeLibrary | null> | null>(
		(data.streamed?.homeLibrary ?? null) as Promise<HomeLibrary | null> | null
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

		homeLibraryPromise = loadPromise;

		try {
			await loadPromise;
		} catch (error) {
			console.error('Failed to refresh home library data', error);
			refreshError = error instanceof Error ? error.message : 'Failed to refresh spotlight.';
			if (lastResolvedLibrary) {
				homeLibraryPromise = Promise.resolve(lastResolvedLibrary);
			}
		} finally {
			isRefreshing = false;
		}
	}

	$effect(() => {
		const streamed = data.streamed?.homeLibrary;
		if (streamed) {
			homeLibraryPromise = streamed as Promise<HomeLibrary | null>;
		}
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

<div class="min-h-screen text-foreground">
	<div class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
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
					{@const collections = Array.isArray(library?.collections) ? library.collections : []}
					{@const genres = Array.isArray(library?.genres) ? library.genres : []}
					{@const featuredMovie = trendingMovies.at(0) ?? null}

					<main
						class="flex min-h-[calc(100vh-2rem)] flex-col gap-12 overflow-hidden rounded-lg bg-card/80 shadow-xl backdrop-blur"
					>
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
								<PersonalizedRows />
							</div>

							{#if trendingMovies.length > 0}
								<TrendingMoviesSlider title="Trending Now" movies={trendingMovies} />
							{/if}

							{#if trendingMovies.length === 0 && collections.length === 0 && genres.length === 0}
								<p class="text-sm text-foreground/70">
									No movies available yet. Try refreshing the library.
								</p>
							{/if}

							{#each collections as collection (collection.id)}
								{#if Array.isArray(collection.movies) && collection.movies.length > 0}
									<MovieScrollContainer
										title={collection.name}
										movies={collection.movies}
										linkTo={`/collection/${collection.slug}`}
									/>
								{/if}
							{/each}

							{#each genres as genre (genre.id)}
								{#if Array.isArray(genre.movies) && genre.movies.length > 0}
									<MovieScrollContainer
										title={genre.name}
										movies={genre.movies}
										linkTo={`/genre/${genre.slug}`}
									/>
								{/if}
							{/each}
						</div>
					</main>
				{/if}
			{:catch}
				<HomePageSkeleton />
			{/await}
		{:else}
			<HomePageSkeleton />
		{/if}
	</div>
</div>
