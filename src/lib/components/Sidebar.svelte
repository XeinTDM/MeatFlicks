<script lang="ts">
	import { goto } from '$app/navigation';
	import { Cog } from '@lucide/svelte';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarProvider,
		SidebarTrigger,
		SidebarHeader,
		SidebarInset,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton
	} from '$lib/components/ui/sidebar';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';
	import NavigationMenu from '$lib/components/NavigationMenu.svelte';
	import {
		browseNav,
		primaryNav,
		libraryNav,
		type NavigationItem
	} from '$lib/components/navigation';
	import { media } from 'svelte-match-media';

	let isSettingsOpen = $state(false);
	let { children } = $props<{ children?: () => any }>(); // TODO: Replace any with proper type

	const handleItemSelect = (item: NavigationItem) => {
		if (item.onSelect) {
			item.onSelect();
			return;
		}

		if (item.href) {
			void goto(item.href);
		}
	};
</script>

<SidebarProvider>
	<Sidebar
		collapsible={$media?.desktop ? 'none' : 'offcanvas'}
		class="group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0 [&_[data-slot=sidebar-inner]]:bg-background"
	>
		<SidebarHeader class="px-2 py-2">
			<SidebarGroup class="rounded-lg bg-card">
				<SidebarGroupContent>
					<NavigationMenu items={primaryNav} onItemSelected={handleItemSelect} />
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarHeader>

		<SidebarContent class="px-2 pt-0 pb-2">
			<div class="flex flex-1 flex-col rounded-lg bg-card">
				<SidebarGroup class="px-2 pt-2 pb-2">
					<SidebarGroupContent>
						<NavigationMenu items={browseNav} onItemSelected={handleItemSelect} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarFooter class="mt-auto gap-0 px-2 pt-0 pb-2">
					<SidebarGroup>
						<SidebarGroupContent>
							<NavigationMenu items={libraryNav()} onItemSelected={handleItemSelect} />
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										class="cursor-pointer gap-5 p-2 text-base [&>svg]:!size-6"
										onclick={() => (isSettingsOpen = true)}
										tooltipContent="Settings"
										size="lg"
									>
										<Cog class="h-6 w-6" />
										<span class="font-semibold">Settings</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarFooter>
			</div>
		</SidebarContent>
	</Sidebar>

	<SidebarInset class=" flex min-h-svh flex-1 flex-col text-foreground">
		{@render children?.()}
	</SidebarInset>

	<SidebarTrigger
		class="fixed bottom-4 left-4 z-50 rounded-full border border-border bg-card p-3 text-foreground shadow-md hover:bg-card/80 md:hidden"
	/>
</SidebarProvider>

<SettingsDialog bind:open={isSettingsOpen} />
