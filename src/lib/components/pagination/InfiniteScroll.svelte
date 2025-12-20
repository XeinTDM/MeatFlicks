<script lang="ts">
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		onLoadMore: () => void | Promise<void>;
		hasMore: boolean;
		isLoading?: boolean;
		threshold?: number; // Distance from bottom in pixels before triggering load
	}

	let { onLoadMore, hasMore, isLoading = false, threshold = 200 }: Props = $props();

	let sentinelRef = $state<HTMLElement | null>(null);
	let observer: IntersectionObserver | null = null;

	$effect(() => {
		if (typeof window === 'undefined' || !sentinelRef || !hasMore || isLoading) {
			return;
		}

		// Clean up previous observer
		if (observer) {
			observer.disconnect();
		}

		// Create new intersection observer
		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && hasMore && !isLoading) {
					onLoadMore();
				}
			},
			{
				rootMargin: `${threshold}px`
			}
		);

		observer.observe(sentinelRef);

		return () => {
			if (observer) {
				observer.disconnect();
			}
		};
	});
</script>

{#if hasMore}
	<div bind:this={sentinelRef} class="flex items-center justify-center py-8">
		{#if isLoading}
			<div class="flex items-center gap-2 text-muted-foreground">
				<Loader2 class="size-5 animate-spin" />
				<span class="text-sm">Loading more...</span>
			</div>
		{/if}
	</div>
{/if}
