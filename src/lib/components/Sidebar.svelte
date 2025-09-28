<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import type { Route } from "$types";
	import {
		House,
		Search,
		Clapperboard,
		Tv,
		Sparkles,
		BookOpen,
		History as HistoryIcon,
		Bookmark,
		Cog
	} from '@lucide/svelte';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarMenu,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarProvider,
		SidebarTrigger,
		SidebarHeader,
		SidebarInset
	} from '$lib/components/ui/sidebar';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';

	type IconComponent = typeof House;
	type NavigationItem = {
		label: string;
		icon: IconComponent;
		href?: Route;
		onSelect?: () => void;
	};

	let isSettingsOpen = $state(false);
	let content: (() => any) | undefined;

	const pageStore = page;
	const currentPath = $derived($pageStore.url.pathname);

	const primaryNav: NavigationItem[] = [
		{ label: 'Home', icon: House, href: '/' },
		{ label: 'Search', icon: Search, href: '/(app)/search' }
	];

	const browseNav: NavigationItem[] = [
		{ label: 'Movies', icon: Clapperboard, href: '/(app)/explore/movies' },
		{ label: 'TV Series', icon: Tv, href: '/(app)/explore/tv-shows' },
		{ label: 'Anime', icon: Sparkles, href: '/(app)/explore/anime' },
		{ label: 'Manga', icon: BookOpen, href: '/(app)/explore/manga' }
	];

	const libraryNav: NavigationItem[] = [
		{ label: 'History', icon: HistoryIcon, href: '/(app)/history' },
		{ label: 'Watchlist', icon: Bookmark, href: '/(app)/watchlist' },
		{ label: 'Settings', icon: Cog, onSelect: () => (isSettingsOpen = true) }
	];

	const handleItemSelect = (item: NavigationItem) => {
		if (item.onSelect) {
			item.onSelect();
			return;
		}

		if (item.href) {
			const target = resolve(item.href);
			void goto(target);
		}
	};

	const isActive = (item: NavigationItem) => {
		if (!item.href) return false;
		const target = resolve(item.href);
		if (target === '/') {
			return currentPath === target;
		}

		return currentPath.startsWith(target);
	};
</script>

<SidebarProvider>
	<Sidebar collapsible="offcanvas">
		<SidebarHeader class="px-2 py-2">
			<SidebarGroup class="bg-primary rounded">
				<SidebarGroupContent>
					<SidebarMenu>
						{#each primaryNav as item (item.href ?? item.label)}
							<SidebarMenuItem>
								<SidebarMenuButton
									isActive={isActive(item)}
									onclick={() => handleItemSelect(item)}
									tooltipContent={item.label}
									class="cursor-pointer"
								>
									<item.icon class="h-4 w-4" />
									<span>{item.label}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarHeader>

		<SidebarContent class="px-2 py-4">
			<div class="bg-primary rounded flex flex-1 flex-col">
				<SidebarGroup class="px-2 pt-2 pb-2">
					<SidebarGroupContent>
						<SidebarMenu>
							{#each browseNav as item (item.href ?? item.label)}
								<SidebarMenuItem>
									<SidebarMenuButton
										class="cursor-pointer"
										isActive={isActive(item)}
										onclick={() => handleItemSelect(item)}
										tooltipContent={item.label}
									>
										<item.icon class="h-4 w-4" />
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							{/each}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarFooter class="mt-auto gap-0 px-2 pb-2 pt-0">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{#each libraryNav as item (item.href ?? item.label)}
									<SidebarMenuItem>
										<SidebarMenuButton
											class="cursor-pointer"
											isActive={isActive(item)}
											onclick={() => handleItemSelect(item)}
											tooltipContent={item.label}
										>
											<item.icon class="h-4 w-4" />
											<span>{item.label}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								{/each}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarFooter>
			</div>
		</SidebarContent>
	</Sidebar>

	<SidebarInset class="bg-bg-color text-text-color flex min-h-svh flex-1 flex-col">
		{@render content?.()}
	</SidebarInset>

	<SidebarTrigger class="bg-bg-color-alt text-text-color border-border-color hover:bg-bg-color-alt/80 fixed bottom-4 left-4 z-50 rounded-full border p-3 shadow-md md:hidden" />
</SidebarProvider>

<SettingsDialog bind:open={isSettingsOpen} />
