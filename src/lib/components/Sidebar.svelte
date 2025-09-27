<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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
		Cog,
		Sun,
		Moon,
		Download,
		Upload,
		ListX,
		Trash2
	} from '@lucide/svelte';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
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
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import type { Movie } from '$lib/state/stores/watchlistStore';
	import type { HistoryEntry } from '$lib/state/stores/historyStore';

	type DataNotice = { text: string; tone: 'success' | 'error' };
	type IconComponent = typeof House;
	type NavigationItem = {
		label: string;
		icon: IconComponent;
		href?: string;
		onSelect?: () => void;
	};

	let isSettingsOpen = $state(false);
	let importInput = $state<HTMLInputElement | null>(null);
	let settingsTab = $state<'preferences' | 'data'>('preferences');
	let dataNotice = $state<DataNotice | null>(null);
	let autoplayNext = $state(true);
	let autoplayTrailers = $state(false);
	let limitCellularData = $state(true);
	let emailUpdates = $state(true);
	let pushReminders = $state(false);

	const watchlistState = $derived($watchlist);
	const historyState = $derived($watchHistory);
	const watchlistCount = $derived(watchlistState.watchlist.length);
	const historyCount = $derived(historyState.entries.length);

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
		{ label: 'History', icon: HistoryIcon, href: '/collection/history' },
		{ label: 'Watchlist', icon: Bookmark, href: '/watchlist' },
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

	const resetPreferences = () => {
		autoplayNext = true;
		autoplayTrailers = false;
		limitCellularData = true;
		emailUpdates = true;
		pushReminders = false;
		dataNotice = { text: 'Preferences reset to defaults.', tone: 'success' };
	};

	const clearWatchlist = () => {
		watchlist.clear();
		dataNotice = { text: 'Watchlist cleared.', tone: 'success' };
	};

	const clearWatchHistory = () => {
		watchHistory.clear();
		dataNotice = { text: 'Watch history cleared.', tone: 'success' };
	};

	const handleExport = () => {
		try {
			const payload = {
				version: 1,
				generatedAt: new Date().toISOString(),
				watchlist: watchlist.exportData(),
				history: watchHistory.exportData()
			};

			const blob = new Blob([JSON.stringify(payload, null, 2)], {
				type: 'application/json'
			});

			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'meatflicks-data.json';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			dataNotice = { text: 'Data exported successfully.', tone: 'success' };
		} catch (error) {
			console.error('Failed to export data:', error);
			dataNotice = { text: 'Failed to export data. Please try again.', tone: 'error' };
		}
	};

	const triggerImport = () => {
		dataNotice = null;
		importInput?.click();
	};

	const handleImport = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as Record<string, unknown>;

			if ('watchlist' in parsed && Array.isArray(parsed.watchlist)) {
				watchlist.replaceAll(parsed.watchlist as Movie[]);
			}

			if ('history' in parsed && Array.isArray(parsed.history)) {
				watchHistory.replaceAll(parsed.history as HistoryEntry[]);
			}

			dataNotice = { text: 'Data imported successfully.', tone: 'success' };
		} catch (error) {
			console.error('Failed to import data:', error);
			dataNotice = { text: 'Failed to import data. Ensure the file is valid JSON.', tone: 'error' };
		} finally {
			input.value = '';
		}
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
								>
									<svelte:component this={item.icon} class="h-4 w-4" />
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
										isActive={isActive(item)}
										onclick={() => handleItemSelect(item)}
										tooltipContent={item.label}
									>
										<svelte:component this={item.icon} class="h-4 w-4" />
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
											isActive={isActive(item)}
											onclick={() => handleItemSelect(item)}
											tooltipContent={item.label}
										>
											<svelte:component this={item.icon} class="h-4 w-4" />
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
		<slot />
	</SidebarInset>

	<SidebarTrigger class="bg-bg-color-alt text-text-color border-border-color hover:bg-bg-color-alt/80 fixed bottom-4 left-4 z-50 rounded-full border p-3 shadow-md md:hidden" />
</SidebarProvider>

<Dialog bind:open={isSettingsOpen}>
	<DialogContent
		id="settings-dialog"
		class="border-border-color bg-bg-color-alt text-text-color grid h-[80vh] w-[92vw] max-w-[900px] grid-rows-[auto,1fr] overflow-hidden border sm:w-[640px] md:w-[720px]"
	>
		<div class="flex h-full flex-col">
			<DialogHeader class="space-y-1">
				<DialogTitle class="text-lg font-semibold">Settings</DialogTitle>
				<DialogDescription class="text-sm text-muted-foreground">
					Manage your preferences and data.
				</DialogDescription>
			</DialogHeader>

			<Tabs
				value={settingsTab}
				onValueChange={(value: string) => (settingsTab = value as 'preferences' | 'data')}
				class="mt-6 flex flex-1 flex-col overflow-hidden"
			>
				<TabsList class="grid w-full grid-cols-2">
					<TabsTrigger value="preferences">Preferences</TabsTrigger>
					<TabsTrigger value="data">Data</TabsTrigger>
				</TabsList>

				<TabsContent value="preferences" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Theme
						</h4>
						<div class="bg-bg-color border-border-color flex rounded-md border p-0.5">
							<Button
								onclick={toggleMode}
								variant="outline"
								size="icon"
								aria-label="Toggle theme"
							>
								<Sun
									class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
								/>
								<Moon
									class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
								/>
								<span class="sr-only">Toggle theme</span>
							</Button>
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Playback
						</h4>
						<div class="space-y-3">
							<div class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4">
								<div class="space-y-1">
									<Label for="autoplay-next" class="text-text-color text-sm font-medium">
										Autoplay next episode
									</Label>
									<p id="autoplay-next-description" class="text-xs text-muted-foreground">
										Start the next episode automatically after finishing.
									</p>
								</div>
								<Switch
									id="autoplay-next"
									bind:checked={autoplayNext}
									aria-describedby="autoplay-next-description"
								/>
							</div>
							<div class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4">
								<div class="space-y-1">
									<Label for="autoplay-trailers" class="text-text-color text-sm font-medium">
										Autoplay trailers
									</Label>
									<p id="autoplay-trailers-description" class="text-xs text-muted-foreground">
										Play previews while browsing titles.
									</p>
								</div>
								<Switch
									id="autoplay-trailers"
									bind:checked={autoplayTrailers}
									aria-describedby="autoplay-trailers-description"
								/>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Data Usage
						</h4>
						<div class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4">
							<div class="space-y-1">
								<Label for="limit-cellular" class="text-text-color text-sm font-medium">
									Limit streaming on cellular
								</Label>
								<p id="limit-cellular-description" class="text-xs text-muted-foreground">
									Reduce video quality when using mobile data.
								</p>
							</div>
							<Switch
								id="limit-cellular"
								bind:checked={limitCellularData}
								aria-describedby="limit-cellular-description"
							/>
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Notifications
						</h4>
						<div class="space-y-3">
							<div class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4">
								<div class="space-y-1">
									<Label for="email-updates" class="text-text-color text-sm font-medium">
										Email updates
									</Label>
									<p id="email-updates-description" class="text-xs text-muted-foreground">
										Get new release emails tailored to your watchlist.
									</p>
								</div>
								<Switch
									id="email-updates"
									bind:checked={emailUpdates}
									aria-describedby="email-updates-description"
								/>
							</div>
							<div class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4">
								<div class="space-y-1">
									<Label for="push-reminders" class="text-text-color text-sm font-medium">
										Push reminders
									</Label>
									<p id="push-reminders-description" class="text-xs text-muted-foreground">
										Receive reminders when new episodes go live.
									</p>
								</div>
								<Switch
									id="push-reminders"
									bind:checked={pushReminders}
									aria-describedby="push-reminders-description"
								/>
							</div>
						</div>
					</section>

					<Separator />

					<div class="flex justify-end">
						<Button variant="outline" class="gap-2" onclick={resetPreferences}>
							Reset to defaults
						</Button>
					</div>
				</TabsContent>

				<TabsContent value="data" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Account storage
						</h4>
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="border-border-color bg-bg-color rounded-lg border p-4">
								<p class="text-xs text-muted-foreground uppercase">Watchlist items</p>
								<p class="text-text-color text-2xl font-semibold">{watchlistCount}</p>
							</div>
							<div class="border-border-color bg-bg-color rounded-lg border p-4">
								<p class="text-xs text-muted-foreground uppercase">History entries</p>
								<p class="text-text-color text-2xl font-semibold">{historyCount}</p>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Data management
						</h4>
						<div class="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" class="justify-start gap-2" onclick={handleExport}>
								<Download class="h-4 w-4" />
								Export data
							</Button>
							<Button variant="outline" class="justify-start gap-2" onclick={triggerImport}>
								<Upload class="h-4 w-4" />
								Import data
							</Button>
						</div>
						<Input
							bind:ref={importInput}
							type="file"
							accept="application/json"
							class="hidden"
							onchange={handleImport}
						/>
					</section>

					<Separator />

					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold tracking-wider uppercase">
							Quick cleanup
						</h4>
						<div class="grid gap-2 sm:grid-cols-2">
							<Button variant="outline" class="justify-start gap-2" onclick={clearWatchlist}>
								<ListX class="h-4 w-4" />
								Clear watchlist
							</Button>
							<Button
								variant="destructive"
								class="justify-start gap-2"
								onclick={clearWatchHistory}
							>
								<Trash2 class="h-4 w-4" />
								Clear watch history
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							Clearing data removes it from this device. Export your data first if you want a backup.
						</p>
					</section>
				</TabsContent>
			</Tabs>

			{#if dataNotice}
				<p
					class={`mt-4 text-center text-xs ${dataNotice.tone === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
					role="status"
				>
					{dataNotice.text}
				</p>
			{/if}
		</div>
	</DialogContent>
</Dialog>