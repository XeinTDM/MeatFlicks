<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';

	interface Props {
		onLoadMore: () => void | Promise<void>;
		hasMore: boolean;
		isLoading?: boolean;
		threshold?: number;
	}

	let { onLoadMore, hasMore, isLoading = false, threshold = 200 }: Props = $props();

	let sentinelRef = $state<HTMLElement | null>(null);
	let observer: IntersectionObserver | null = null;

	$effect(() => {
		if (typeof window === 'undefined' || !sentinelRef || !hasMore || isLoading) {
			return;
		}

		if (observer) {
			observer.disconnect();
		}

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
				<LoaderCircle class="size-5 animate-spin" />
				<span class="text-sm">Loading more...</span>
			</div>
		{/if}
	</div>
{/if}
