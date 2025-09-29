<script lang="ts">
	import { page } from '$app/state';
	import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '$lib/components/ui/sidebar';
	import {
		House,
		Search,
		Clapperboard,
		Tv,
		Sparkles,
		BookOpen,
		History,
		Bookmark
	} from '@lucide/svelte';
	import type { NavigationItem } from './navigation';

	let {
		items,
		onItemSelected
	}: { items: NavigationItem[]; onItemSelected: (item: NavigationItem) => void } = $props();

	const isActive = (item: NavigationItem) => {
		if (!item.href) return false;
		if (item.href === '/') {
			return page.url.pathname === item.href;
		}

		return page.url.pathname.startsWith(item.href);
	};
</script>

<SidebarMenu>
	{#each items as item (item.href ?? item.label)}
		<SidebarMenuItem>
			<SidebarMenuButton
				class="cursor-pointer gap-5 p-2 text-base [&>svg]:!size-6"
				isActive={isActive(item)}
				onclick={() => onItemSelected(item)}
				tooltipContent={item.label}
				size="lg"
			>
				{#if item.label === 'Home'}
					<House class="h-6 w-6" />
				{:else if item.label === 'Search'}
					<Search class="h-6 w-6" />
				{:else if item.label === 'Movies'}
					<Clapperboard class="h-6 w-6" />
				{:else if item.label === 'TV Series'}
					<Tv class="h-6 w-6" />
				{:else if item.label === 'Anime'}
					<Sparkles class="h-6 w-6" />
				{:else if item.label === 'Manga'}
					<BookOpen class="h-6 w-6" />
				{:else if item.label === 'History'}
					<History class="h-6 w-6" />
				{:else if item.label === 'Watchlist'}
					<Bookmark class="h-6 w-6" />
				{/if}
				<span class="font-semibold">{item.label}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	{/each}
</SidebarMenu>
