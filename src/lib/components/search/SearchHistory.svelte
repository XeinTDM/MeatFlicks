<script lang="ts">
	import { Clock, X, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { goto } from '$app/navigation';

	interface SearchHistoryItem {
		id: number;
		query: string;
		searchedAt: number;
	}

	interface Props {
		searches: SearchHistoryItem[];
		onSearchSelect?: (query: string) => void;
		onDelete?: (id: number) => void;
		onClearAll?: () => void;
		maxItems?: number;
	}

	let { searches = [], onSearchSelect, onDelete, onClearAll, maxItems = 10 }: Props = $props();

	const displayedSearches = $derived(searches.slice(0, maxItems));

	function formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	function handleSearchClick(query: string) {
		const getResolvedPath = (path: string) => (path.startsWith('/') ? path : `/${path}`);
		if (onSearchSelect) {
			onSearchSelect(query);
		} else {
			goto(getResolvedPath(`/search?q=${encodeURIComponent(query)}`));
		}
	}

	function handleDelete(e: MouseEvent, id: number) {
		e.stopPropagation();
		if (onDelete) {
			onDelete(id);
		}
	}

	function handleClearAll(e: MouseEvent) {
		e.stopPropagation();
		if (onClearAll) {
			onClearAll();
		}
	}
</script>

{#if displayedSearches.length > 0}
	<Card.Root class="overflow-hidden border-border/60">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
			<Card.Title class="text-sm font-medium">Recent Searches</Card.Title>
			{#if onClearAll}
				<Button
					variant="ghost"
					size="sm"
					onclick={handleClearAll}
					class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
					aria-label="Clear all search history"
				>
					<Trash2 class="size-3" />
					Clear
				</Button>
			{/if}
		</Card.Header>
		<Card.Content class="space-y-1 p-0">
			{#each displayedSearches as search (search.id)}
				<button
					type="button"
					onclick={() => handleSearchClick(search.query)}
					class="group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					aria-label={`Search for ${search.query}`}
				>
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<Clock class="size-4 shrink-0 text-muted-foreground" />
						<span class="truncate">{search.query}</span>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<span class="text-xs text-muted-foreground">{formatTimeAgo(search.searchedAt)}</span>
						{#if onDelete}
							<Button
								variant="ghost"
								size="sm"
								onclick={(e) => handleDelete(e, search.id)}
								class="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
								aria-label={`Delete search: ${search.query}`}
							>
								<X class="size-3" />
							</Button>
						{/if}
					</div>
				</button>
				{#if search !== displayedSearches[displayedSearches.length - 1]}
					<Separator class="bg-border/60" />
				{/if}
			{/each}
		</Card.Content>
	</Card.Root>
{:else}
	<div class="rounded-md border border-dashed border-border/60 p-6 text-center">
		<Clock class="mx-auto mb-2 size-8 text-muted-foreground" />
		<p class="text-sm text-muted-foreground">No recent searches</p>
	</div>
{/if}
