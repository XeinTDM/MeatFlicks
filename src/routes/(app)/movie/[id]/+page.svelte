<script lang="ts">
	import type { PageData } from './$types';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';
	import type { StreamingSource } from '$lib/streaming';
	import { Button } from '$lib/components/ui/button';
	import { watchHistory } from '$lib/state/stores/historyStore';

	let { data }: { data: PageData } = $props();
	const { movie, streaming } = data;

	type StreamingState = {
		source: StreamingSource | null;
		resolutions: ProviderResolution[];
	};

	let currentStreaming = $state<StreamingState>({
		source: streaming?.source ?? null,
		resolutions: Array.isArray(streaming?.resolutions) ? [...streaming.resolutions] : []
	});
	let selectedProvider = $state<string | null>(null);
	let isResolving = $state(false);
	let hasRequestedPlayback = $state(Boolean(streaming?.source));
	let resolveError = $state<string | null>(null);

	let providerResolutions = $derived(currentStreaming.resolutions);
	let primarySource = $derived(currentStreaming.source);
	let playbackUrl = $derived(primarySource?.embedUrl ?? primarySource?.streamUrl ?? null);
	let displayPlayer = $derived(hasRequestedPlayback && Boolean(playbackUrl));
	let primaryLabel = $derived(
		primarySource
			? (providerResolutions.find((r) => r.providerId === primarySource.providerId)?.label ??
					primarySource.providerId)
			: null
	);
	let releaseYear = $derived(
		movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : 'N/A'
	);

	$effect(() => {
		if (typeof window !== 'undefined' && movie?.id) {
			const normalizedGenres =
				movie.genres?.map((genre) => ('name' in genre ? String(genre.name) : String(genre))) ?? [];

			watchHistory.recordWatch({
				id: movie.id,
				title: movie.title,
				posterPath: movie.posterPath ?? null,
				backdropPath: movie.backdropPath ?? null,
				overview: movie.overview ?? null,
				releaseDate: movie.releaseDate ? new Date(movie.releaseDate).toISOString() : null,
				rating: movie.rating ?? 0,
				genres: normalizedGenres,
				trailerUrl: movie.trailerUrl ?? null,
				media_type: 'movie',
				is4K: movie.is4K,
				isHD: movie.isHD ?? undefined,
				tmdbId: movie.tmdbId,
				imdbId: movie.imdbId ?? undefined,
				durationMinutes: movie.durationMinutes ?? null,
				collectionId: movie.collectionId ?? null
			});
		}
	});

	$effect(() => {
		if (!selectedProvider && providerResolutions.length > 0) {
			selectedProvider =
				primarySource?.providerId ??
				providerResolutions.find((r) => r.success)?.providerId ??
				providerResolutions[0]?.providerId ??
				null;
		}
	});

	$effect(() => {
		if (
			selectedProvider &&
			providerResolutions.length > 0 &&
			!providerResolutions.some((r) => r.providerId === selectedProvider)
		) {
			selectedProvider =
				providerResolutions.find((r) => r.success)?.providerId ??
				providerResolutions[0]?.providerId ??
				null;
		}
	});

	$effect(() => {
		if (currentStreaming.source && !hasRequestedPlayback) {
			hasRequestedPlayback = true;
		}
	});

	async function requestProviderResolution(providerId: string) {
		if (!movie?.tmdbId) return;

		isResolving = true;
		resolveError = null;

		try {
			const response = await fetch('/api/streaming', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mediaType: 'movie',
					tmdbId: Number(movie.tmdbId),
					imdbId: movie.imdbId ?? undefined,
					preferredProviders: providerId ? [providerId] : undefined
				})
			});

			if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

			const payload = await response.json();

			currentStreaming = {
				source: payload?.source ?? null,
				resolutions: Array.isArray(payload?.resolutions) ? [...payload.resolutions] : []
			};

			const resolvedProviderId = currentStreaming.source?.providerId ?? null;
			if (resolvedProviderId && resolvedProviderId !== selectedProvider) {
				selectedProvider = resolvedProviderId;
			}

			if (!currentStreaming.source) {
				resolveError = 'Provider did not return a playable stream. Please try another option.';
			} else {
				hasRequestedPlayback = true;
			}
		} catch (error) {
			console.error('[movie][resolveProvider]', error);
			resolveError = error instanceof Error ? error.message : 'Failed to load provider stream.';
		} finally {
			isResolving = false;
		}
	}

	function handleProviderSelectionChange(providerId: string) {
		resolveError = null;
		if (selectedProvider === providerId) {
			return;
		}

		selectedProvider = providerId;
	}

	async function handlePlayClick() {
		if (!selectedProvider) {
			resolveError = 'Select a provider before playing.';
			return;
		}

		const alreadyResolved = primarySource?.providerId === selectedProvider && Boolean(playbackUrl);

		if (alreadyResolved) {
			hasRequestedPlayback = true;
			return;
		}

		await requestProviderResolution(selectedProvider);
	}

	function handleOpenInNewTab() {
		if (!playbackUrl) return;
		window.open(playbackUrl, '_blank', 'noopener,noreferrer');
	}
</script>

{#if !movie}
	<div class="flex min-h-screen flex-col items-center justify-center text-foreground">
		<h1 class="text-4xl font-bold">Movie Not Found</h1>
		<p class="text-lg">The movie you are looking for does not exist.</p>
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<main class="container mx-auto p-4">
			<div class="relative mb-8 h-96 w-full">
				{#if movie.backdropPath}
					<img
						src={movie.backdropPath}
						alt={movie.title}
						class="h-full w-full rounded-lg object-cover"
					/>
				{/if}
				<div class="absolute inset-0 rounded-lg bg-gradient-to-t from-black to-transparent"></div>
				<div class="absolute bottom-4 left-4">
					<h1 class="text-5xl font-bold text-foreground">{movie.title}</h1>
					<p class="text-xl text-gray-300">
						{releaseYear} | {movie.durationMinutes} min
					</p>
				</div>
			</div>

			{#if providerResolutions.length}
				<section class="mb-6">
					<h3 class="mb-3 text-xl font-semibold">Choose Provider</h3>
					<p class="mb-2 text-sm text-muted-foreground">
						Pick a streaming API and then press play to load the player.
					</p>
					{#if resolveError}
						<p class="mb-2 text-sm text-red-400">{resolveError}</p>
					{/if}
					<fieldset class="space-y-2">
						{#each providerResolutions as resolution (resolution.providerId)}
							<label
								class={`flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-shadow duration-200 ${
									selectedProvider === resolution.providerId ? 'ring-2 ring-primary' : 'ring-0'
								}`}
							>
								<input
									type="radio"
									name="streaming-provider"
									class="mt-1 h-4 w-4 accent-primary"
									value={resolution.providerId}
									checked={selectedProvider === resolution.providerId}
									onchange={() => handleProviderSelectionChange(resolution.providerId)}
									disabled={isResolving && selectedProvider !== resolution.providerId}
								/>
								<div class="flex w-full items-start justify-between gap-3">
									<div>
										<p class="text-sm font-semibold tracking-wide uppercase">{resolution.label}</p>
										<p class="text-xs text-gray-400">
											{#if resolution.success}
												Ready to play.
											{:else if resolution.error}
												{resolution.error}
											{:else}
												Unavailable.
											{/if}
										</p>
									</div>
									<span
										class={`text-xs font-semibold uppercase ${
											resolution.success ? 'text-green-400' : 'text-red-400'
										}`}
									>
										{resolution.success ? 'Ready' : 'Unavailable'}
									</span>
								</div>
							</label>
						{/each}
					</fieldset>
					<div class="mt-4 flex flex-wrap items-center gap-3">
						<Button
							type="button"
							onclick={handlePlayClick}
							disabled={!selectedProvider || isResolving}
						>
							{#if isResolving}
								Loading…
							{:else}
								Play
							{/if}
						</Button>
						{#if hasRequestedPlayback && playbackUrl}
							<Button type="button" variant="secondary" onclick={handleOpenInNewTab}>
								Open in new tab
							</Button>
						{/if}
					</div>
					{#if isResolving}
						<p class="mt-2 text-xs text-gray-400">Loading stream…</p>
					{/if}
				</section>
			{/if}

			{#if playbackUrl && displayPlayer}
				<section class="mb-8">
					<h2 class="mb-4 text-3xl font-bold">Watch Now</h2>
					<div class="aspect-video w-full overflow-hidden rounded-lg bg-black">
						{#if primarySource?.embedUrl}
							<iframe
								src={primarySource.embedUrl}
								title={`Watch ${movie.title}`}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
								class="h-full w-full"
							></iframe>
						{:else if primarySource?.streamUrl}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								controls
								preload="metadata"
								poster={movie.posterPath ?? undefined}
								class="h-full w-full bg-black"
							>
								<source src={primarySource.streamUrl} type="video/mp4" />
								Your browser does not support the video tag.
							</video>
						{/if}
					</div>
					{#if primaryLabel}
						<p class="mt-2 text-sm text-gray-400">Source: {primaryLabel}</p>
					{/if}
				</section>
			{:else if hasRequestedPlayback}
				<section class="mb-8">
					<h2 class="mb-4 text-3xl font-bold">Watch Now</h2>
					<p class="text-sm text-gray-400">
						We couldn't load a playable stream from the selected provider. Try another option above.
					</p>
				</section>
			{:else}
				<section class="mb-8">
					<h2 class="mb-2 text-3xl font-bold">Watch Now</h2>
					<p class="text-sm text-gray-400">
						Select your preferred provider and click play to start streaming.
					</p>
				</section>
			{/if}

			<div class="flex flex-col gap-8 md:flex-row">
				<div class="md:w-1/3 lg:w-1/4">
					{#if movie.posterPath}
						<img
							src={movie.posterPath}
							alt={movie.title}
							width="300"
							height="450"
							class="rounded-lg shadow-lg"
						/>
					{/if}
				</div>
				<div class="md:w-2/3 lg:w-3/4">
					<h2 class="mb-4 text-3xl font-bold">Overview</h2>
					<p class="mb-4 text-lg text-gray-300">{movie.overview}</p>

					<div class="mb-4">
						<h3 class="text-2xl font-bold">Rating: {movie.rating?.toFixed(1)} / 10</h3>
					</div>

					<div class="mb-4">
						<h3 class="text-2xl font-bold">Genres:</h3>
						<p class="text-lg text-gray-300">
							{#if movie.genres && movie.genres.length > 0}
								{movie.genres.map((genre) => genre.name).join(', ')}
							{:else}
								N/A
							{/if}
						</p>
					</div>

					{#if movie.cast && movie.cast.length > 0}
						<div class="mb-4">
							<h3 class="text-2xl font-bold">Cast:</h3>
							<p class="text-lg text-gray-300">
								{movie.cast.map((actor) => actor.name).join(', ')}
							</p>
						</div>
					{/if}

					{#if movie.trailerUrl}
						<div class="mb-4">
							<h3 class="text-2xl font-bold">Trailer:</h3>
							<div class="flex aspect-video items-center justify-center rounded-lg bg-gray-800">
								<iframe
									src={movie.trailerUrl}
									title="Movie Trailer"
									frameborder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowfullscreen
									class="h-full w-full rounded-lg"
								></iframe>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</main>
	</div>
{/if}
