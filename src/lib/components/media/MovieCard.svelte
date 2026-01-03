<script lang="ts">
	import { Plus, Minus, Star } from '@lucide/svelte';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import type { Movie as WatchlistMovie } from '$lib/state/stores/watchlistStore.svelte';
	import { error as errorStore } from '$lib/state/stores/errorStore';

	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { LibraryMovie } from '$lib/types/library';

	let { movie }: { movie: LibraryMovie | WatchlistMovie | null } = $props();

	const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);

	function handleWatchlistToggle(event: MouseEvent) {
		event.stopPropagation();

		if (!movie) {
			errorStore.set('No movie selected.');
			return;
		}

		try {
			if (isInWatchlist) {
				watchlist.removeFromWatchlist(movie.id);
			} else {
				watchlist.addToWatchlist(movie);
			}
		} catch (err) {
			console.error('Failed to update watchlist:', err);
			errorStore.set('Failed to update watchlist. Please try again.');
		}
	}

	const detailsHref = $derived.by(() => {
		if (!movie) return '/';
		if (movie.canonicalPath) return `/${movie.canonicalPath.replace(/^\//, '')}`;

		const type = movie.mediaType || movie.media_type || 'movie';
		const identifier = movie.id;

		return `/${type}/${identifier}`;
	});
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a
	rel="external"
	href={detailsHref}
	aria-label={movie ? `View details for ${movie.title}` : 'Loading movie'}
	class="group relative h-72 w-48 cursor-pointer overflow-hidden rounded-xl transition-transform duration-300 ease-in-out hover:z-10 hover:scale-105 hover:shadow-lg"
>
	<Card class="h-full w-full gap-0 overflow-hidden bg-background p-0">
		<div class="relative h-full w-full flex-1">
			{#if movie?.posterPath}
				<img
					src={movie.posterPath}
					alt={`${movie.title} Poster`}
					loading="lazy"
					class="h-full w-full object-cover transition-opacity duration-400 ease-in-out"
				/>
			{:else if movie}
				<div class="flex h-full w-full flex-1 items-center justify-center bg-muted">
					<span class="text-lg text-muted-foreground">No Image</span>
				</div>
			{:else}
				<Skeleton class="h-full w-full" />
			{/if}
		</div>

		{#if movie}
			<div
				class="absolute inset-0 p-4 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100"
			>
				<div
					class="absolute top-4 left-4 opacity-0 transition-opacity duration-400 ease-in-out group-hover:opacity-100"
				>
					<Badge variant="secondary" class="flex items-center gap-1 bg-black/70 text-white">
						<Star class="size-4 text-yellow-500" fill="currentColor" stroke="currentColor" />
						{movie.rating && typeof movie.rating === 'number' ? movie.rating.toFixed(1) : 'N/A'}
					</Badge>
				</div>

				<div
					class="absolute top-4 right-4 opacity-0 transition-all duration-400 ease-in-out group-hover:scale-100 group-hover:opacity-100"
				>
					<Button
						type="button"
						size="icon"
						variant={isInWatchlist ? 'destructive' : 'secondary'}
						onclick={handleWatchlistToggle}
						class="size-8 rounded-full border border-border shadow-md backdrop-blur-sm"
					>
						{#if isInWatchlist}
							<Minus class="size-4" />
						{:else}
							<Plus class="size-4" />
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</Card>
</a>
