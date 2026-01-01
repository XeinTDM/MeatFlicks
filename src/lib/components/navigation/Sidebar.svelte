<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarProvider,
		SidebarTrigger,
		SidebarInset,
		SidebarMenu,
		SidebarMenuItem
	} from '$lib/components/ui/sidebar';

	import SettingsDialog from '$lib/components/global/SettingsDialog.svelte';
	import NavigationMenu from '$lib/components/navigation/NavigationMenu.svelte';
	import UserProfile from '$lib/components/navigation/UserProfile.svelte';
	import { browseNav, primaryNav, type NavigationItem } from '$lib/components/navigation';
	import { media } from 'svelte-match-media';

	let isSettingsOpen = $state(false);
	let { children } = $props<{ children?: () => Snippet }>();

	const primaryNavItems = primaryNav;
	const browseNavItems = browseNav;
	const isDesktop = $derived(() => Boolean($media?.desktop));
	const sidebarLabel = 'Primary navigation';

	const handleItemSelect = (item: NavigationItem) => {
		if (item.onSelect) {
			item.onSelect();
			return;
		}

		if (item.href) {
			const getResolvedPath = (path: string) => (path.startsWith('/') ? path : `/${path}`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			void goto(getResolvedPath(item.href));
		}
	};
</script>

<SidebarProvider open={false}>
	<Sidebar
		aria-label={sidebarLabel}
		collapsible={isDesktop() ? 'icon' : 'offcanvas'}
		class="min-h-svh bg-background group-data-[side=right]:border-l-0 md:sticky md:top-0"
	>
		<SidebarContent class="px-2 pt-0 pb-2">
			<div class="flex flex-1 flex-col justify-center rounded-lg">
				<SidebarGroup class="px-2 pt-2 pb-2">
					<SidebarGroupContent>
						<NavigationMenu
							items={[...primaryNavItems, ...browseNavItems]}
							onItemSelected={handleItemSelect}
						/>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarFooter class="mt-auto gap-0 px-0 pt-0 pb-2">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem class="flex justify-center">
									<UserProfile onOpenSettings={() => (isSettingsOpen = true)} />
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarFooter>
			</div>
		</SidebarContent>
	</Sidebar>

	<SidebarInset class="flex min-h-svh flex-1 flex-col text-foreground">
		{@render children?.()}
	</SidebarInset>

	<SidebarTrigger
		aria-label="Toggle navigation"
		class="fixed bottom-4 left-4 z-50 rounded-full border border-border bg-card p-3 text-foreground shadow-md hover:bg-card/80 md:hidden"
	/>
</SidebarProvider>

<SettingsDialog bind:open={isSettingsOpen} />
