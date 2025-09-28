<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
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
		href?: string;
		onSelect?: () => void;
	};

	let isSettingsOpen = $state(false);
	let { children } = $props<{ children?: () => any }>();

	const pageStore = page;
	const currentPath = $derived($pageStore.url.pathname);

	const primaryNav: NavigationItem[] = [
		{ label: 'Home', icon: House, href: '/' },
		{ label: 'Search', icon: Search, href: '/search' }
	];

	const browseNav: NavigationItem[] = [
		{ label: 'Movies', icon: Clapperboard, href: '/explore/movies' },
		{ label: 'TV Series', icon: Tv, href: '/explore/tv-shows' },
		{ label: 'Anime', icon: Sparkles, href: '/explore/anime' },
		{ label: 'Manga', icon: BookOpen, href: '/explore/manga' }
	];

	const libraryNav: NavigationItem[] = [
		{ label: 'History', icon: HistoryIcon, href: '/history' },
		{ label: 'Watchlist', icon: Bookmark, href: '/watchlist' },
		{ label: 'Settings', icon: Cog, onSelect: () => (isSettingsOpen = true) }
	];

	const handleItemSelect = (item: NavigationItem) => {
		if (item.onSelect) {
			item.onSelect();
			return;
		}

		if (item.href) {
			void goto(item.href);
		}
	};

	const isActive = (item: NavigationItem) => {
		if (!item.href) return false;
		if (item.href === '/') {
			return currentPath === item.href;
		}

		return currentPath.startsWith(item.href);
	};
</script>

<SidebarProvider>
	<Sidebar
		collapsible="offcanvas"
		class="group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0 [&_[data-slot=sidebar-inner]]:bg-background"
	>
		<SidebarHeader class="px-2 py-2">
			<SidebarGroup class="bg-card rounded-lg">
				<SidebarGroupContent>
					<SidebarMenu>
						{#each primaryNav as item (item.href ?? item.label)}
							<SidebarMenuItem>
								<SidebarMenuButton
									class="cursor-pointer text-base gap-5 p-2 [&>svg]:!size-6"
									isActive={isActive(item)}
									onclick={() => handleItemSelect(item)}
									tooltipContent={item.label}
									size="lg"
								>
									<item.icon class="h-6 w-6" />
									<span class="font-semibold">{item.label}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarHeader>

		<SidebarContent class="px-2 py-2">
			<div class="bg-card rounded-lg flex flex-1 flex-col">
				<SidebarGroup class="px-2 pt-2 pb-2">
					<SidebarGroupContent>
						<SidebarMenu>
							{#each browseNav as item (item.href ?? item.label)}
								<SidebarMenuItem>
									<SidebarMenuButton
										class="cursor-pointer text-base gap-5 p-2 [&>svg]:!size-6"
										isActive={isActive(item)}
										onclick={() => handleItemSelect(item)}
										tooltipContent={item.label}
										size="lg"
									>
										<item.icon class="h-6 w-6" />
										<span class="font-semibold">{item.label}</span>
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
											class="cursor-pointer text-base gap-5 p-2 [&>svg]:!size-6"
											isActive={isActive(item)}
											onclick={() => handleItemSelect(item)}
											tooltipContent={item.label}
											size="lg"
										>
											<item.icon class="h-6 w-6" />
											<span class="font-semibold">{item.label}</span>
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

	<SidebarInset class=" text-foreground flex min-h-svh flex-1 flex-col">
		{@render children?.()}
	</SidebarInset>

	<SidebarTrigger class="bg-card text-foreground border-border hover:bg-card/80 fixed bottom-4 left-4 z-50 rounded-full border p-3 shadow-md md:hidden" />
</SidebarProvider>

<SettingsDialog bind:open={isSettingsOpen} />
