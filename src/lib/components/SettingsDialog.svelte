<script lang="ts">
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
	import { Sun, Moon, Download, Upload, ListX, Trash2 } from '@lucide/svelte';
	import { watchlist } from '$lib/state/stores/watchlistStore';
	import { watchHistory } from '$lib/state/stores/historyStore';
	import type { Movie } from '$lib/state/stores/watchlistStore';
	import type { HistoryEntry } from '$lib/state/stores/historyStore';

	type DataNotice = { text: string; tone: 'success' | 'error' };
	type SettingsTab = 'appearance' | 'playback' | 'notifications' | 'downloads' | 'data';
	type PlaybackQuality = 'auto' | 'high' | 'medium' | 'low';

	let { open = $bindable(false) } = $props<{ open?: boolean }>();

	let importInput = $state<HTMLInputElement | null>(null);
	let settingsTab = $state<SettingsTab>('appearance');
	let dataNotice = $state<DataNotice | null>(null);
	let autoplayNext = $state(true);
	let autoplayTrailers = $state(false);
	let limitCellularData = $state(true);
	let emailUpdates = $state(true);
	let pushReminders = $state(false);
	let showBackdropAnimations = $state(true);
	let emphasizeAccessibility = $state(false);
	let showEpisodeBadges = $state(true);
	let compactSidebar = $state(false);
	let playbackQuality = $state<PlaybackQuality>('auto');
	let skipIntros = $state(true);
	let rememberPlaybackPosition = $state(true);
	let adaptiveAudio = $state(false);
	let wifiOnlyDownloads = $state(true);
	let autoDownloadNewEpisodes = $state(false);
	let autoDeleteFinishedDownloads = $state(false);
	let backgroundRefresh = $state(true);
	let weeklyDigest = $state(false);
	let watchlistAlerts = $state(true);
	let productAnnouncements = $state(false);

	const playbackQualityOptions = [
		{
			value: 'auto',
			label: 'Auto',
			description: 'Balance quality with bandwidth automatically.'
		},
		{
			value: 'high',
			label: 'High',
			description: 'Prioritize resolution for large screens (uses more data).'
		},
		{
			value: 'medium',
			label: 'Medium',
			description: 'Good compromise for shared connections.'
		},
		{
			value: 'low',
			label: 'Low',
			description: 'Cap quality to reduce data usage on slower networks.'
		}
	] as const;

	const watchlistState = $derived($watchlist);
	const historyState = $derived($watchHistory);
	const watchlistCount = $derived(watchlistState.watchlist.length);
	const historyCount = $derived(historyState.entries.length);

	const resetPreferences = () => {
		autoplayNext = true;
		autoplayTrailers = false;
		limitCellularData = true;
		emailUpdates = true;
		pushReminders = false;
		showBackdropAnimations = true;
		emphasizeAccessibility = false;
		showEpisodeBadges = true;
		compactSidebar = false;
		playbackQuality = 'auto';
		skipIntros = true;
		rememberPlaybackPosition = true;
		adaptiveAudio = false;
		wifiOnlyDownloads = true;
		autoDownloadNewEpisodes = false;
		autoDeleteFinishedDownloads = false;
		backgroundRefresh = true;
		weeklyDigest = false;
		watchlistAlerts = true;
		productAnnouncements = false;
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
			dataNotice = {
				text: 'Failed to import data. Ensure the file is valid JSON.',
				tone: 'error'
			};
		} finally {
			input.value = '';
		}
	};
</script>

<Dialog bind:open={open}>
	<DialogContent
		id="settings-dialog"
		class="border-border-color bg-bg-color-alt text-text-color grid h-[80vh] w-[96vw] max-w-[1280px] grid-rows-[auto,1fr] overflow-hidden border sm:w-[760px] md:w-[980px] lg:w-[1160px] xl:w-[1240px]"
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
				onValueChange={(value: string) => (settingsTab = value as SettingsTab)}
				class="mt-6 flex flex-1 flex-col overflow-hidden"
			>
				<TabsList class="grid w-full grid-cols-2 gap-2 overflow-x-auto sm:grid-cols-3 md:grid-cols-5">
					<TabsTrigger value="appearance">Appearance</TabsTrigger>
					<TabsTrigger value="playback">Playback</TabsTrigger>
					<TabsTrigger value="notifications">Notifications</TabsTrigger>
					<TabsTrigger value="downloads">Downloads</TabsTrigger>
					<TabsTrigger value="data">Data &amp; privacy</TabsTrigger>
				</TabsList>

				<TabsContent value="appearance" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">Theme</h4>
						<div class="bg-bg-color border-border-color flex w-fit rounded-md border p-0.5">
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
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">Interface</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="show-animations" class="text-text-color text-sm font-medium">
										Backdrop animations
									</Label>
									<p id="show-animations-description" class="text-xs text-muted-foreground">
										Enable ambient motion on hero art and collection pages.
									</p>
								</div>
								<Switch
									id="show-animations"
									bind:checked={showBackdropAnimations}
									aria-describedby="show-animations-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="show-badges" class="text-text-color text-sm font-medium">
										Show episode badges
									</Label>
									<p id="show-badges-description" class="text-xs text-muted-foreground">
										Display badges for new, expiring, and trending episodes.
									</p>
								</div>
								<Switch
									id="show-badges"
									bind:checked={showEpisodeBadges}
									aria-describedby="show-badges-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="compact-sidebar" class="text-text-color text-sm font-medium">
										Compact sidebar
									</Label>
									<p id="compact-sidebar-description" class="text-xs text-muted-foreground">
										Tighten navigation spacing to see more categories at a glance.
									</p>
								</div>
								<Switch
									id="compact-sidebar"
									bind:checked={compactSidebar}
									aria-describedby="compact-sidebar-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="accessibility-mode" class="text-text-color text-sm font-medium">
										Accessibility emphasis
									</Label>
									<p id="accessibility-mode-description" class="text-xs text-muted-foreground">
										Increase contrast and motion reduction for accessible viewing.
									</p>
								</div>
								<Switch
									id="accessibility-mode"
									bind:checked={emphasizeAccessibility}
									aria-describedby="accessibility-mode-description"
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

				<TabsContent value="playback" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Playback flow
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
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
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div

							class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"

						>

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

						<div class="space-y-1">
									<Label for="skip-intros" class="text-text-color text-sm font-medium">
										Skip intros automatically
									</Label>
									<p id="skip-intros-description" class="text-xs text-muted-foreground">
										Jump past opening credits when available.
									</p>
								</div>
								<Switch
									id="skip-intros"
									bind:checked={skipIntros}
									aria-describedby="skip-intros-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="remember-position" class="text-text-color text-sm font-medium">
										Remember playback position
									</Label>
									<p id="remember-position-description" class="text-xs text-muted-foreground">
										Pick up where you left off across devices.
									</p>
								</div>
								<Switch
									id="remember-position"
									bind:checked={rememberPlaybackPosition}
									aria-describedby="remember-position-description"
								/>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Streaming quality
						</h4>
						<p class="text-xs text-muted-foreground">
							Choose how MeatFlicks balances quality and bandwidth for your account.
						</p>
						<div class="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
							{#each playbackQualityOptions as option}
								<Button
									type="button"
									variant={playbackQuality === option.value ? 'secondary' : 'outline'}
									class="h-auto flex flex-col items-start gap-1 whitespace-normal text-left"
									aria-pressed={playbackQuality === option.value}
									onclick={() => (playbackQuality = option.value)}
								>
									<span class="text-sm font-medium">{option.label}</span>
									<span class="text-xs text-muted-foreground">{option.description}</span>
								</Button>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Bandwidth
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="limit-cellular" class="text-text-color text-sm font-medium">
										Limit cellular data
									</Label>
									<p id="limit-cellular-description" class="text-xs text-muted-foreground">
										Cap streaming quality automatically on mobile networks.
									</p>
								</div>
								<Switch
									id="limit-cellular"
									bind:checked={limitCellularData}
									aria-describedby="limit-cellular-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="adaptive-audio" class="text-text-color text-sm font-medium">
										Adaptive audio
									</Label>
									<p id="adaptive-audio-description" class="text-xs text-muted-foreground">
										Dynamically adjust audio bitrate to avoid buffering.
									</p>
								</div>
								<Switch
									id="adaptive-audio"
									bind:checked={adaptiveAudio}
									aria-describedby="adaptive-audio-description"
								/>
							</div>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="notifications" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Email &amp; push
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
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
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
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

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Personalized alerts
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="weekly-digest" class="text-text-color text-sm font-medium">
										Weekly digest
									</Label>
									<p id="weekly-digest-description" class="text-xs text-muted-foreground">
										A curated recap of releases and recommendations every Friday.
									</p>
								</div>
								<Switch
									id="weekly-digest"
									bind:checked={weeklyDigest}
									aria-describedby="weekly-digest-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="watchlist-alerts" class="text-text-color text-sm font-medium">
										Watchlist alerts
									</Label>
									<p id="watchlist-alerts-description" class="text-xs text-muted-foreground">
										Notify me when shows from my watchlist start streaming.
									</p>
								</div>
								<Switch
									id="watchlist-alerts"
									bind:checked={watchlistAlerts}
									aria-describedby="watchlist-alerts-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label
										for="product-announcements"
										class="text-text-color text-sm font-medium"
									>
										Product announcements
									</Label>
									<p
										id="product-announcements-description"
										class="text-xs text-muted-foreground"
									>
										Hear about new features, betas, and community events.
									</p>
								</div>
								<Switch
									id="product-announcements"
									bind:checked={productAnnouncements}
									aria-describedby="product-announcements-description"
								/>
							</div>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="downloads" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Smart downloads
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="auto-download" class="text-text-color text-sm font-medium">
										Auto download next episodes
									</Label>
									<p id="auto-download-description" class="text-xs text-muted-foreground">
										Keep the next episode ready while you finish the current one.
									</p>
								</div>
								<Switch
									id="auto-download"
									bind:checked={autoDownloadNewEpisodes}
									aria-describedby="auto-download-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="auto-delete" class="text-text-color text-sm font-medium">
										Auto delete finished downloads
									</Label>
									<p id="auto-delete-description" class="text-xs text-muted-foreground">
										Free up space after you complete an episode or film.
									</p>
								</div>
								<Switch
									id="auto-delete"
									bind:checked={autoDeleteFinishedDownloads}
									aria-describedby="auto-delete-description"
								/>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Network usage
						</h4>
						<div class="space-y-3">
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="wifi-only" class="text-text-color text-sm font-medium">
										Wi-Fi only downloads
									</Label>
									<p id="wifi-only-description" class="text-xs text-muted-foreground">
										Prevent downloads from starting on cellular networks.
									</p>
								</div>
								<Switch
									id="wifi-only"
									bind:checked={wifiOnlyDownloads}
									aria-describedby="wifi-only-description"
								/>
							</div>
							<div
								class="border-border-color bg-bg-color flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div class="space-y-1">
									<Label for="background-refresh" class="text-text-color text-sm font-medium">
										Background refresh
									</Label>
									<p
										id="background-refresh-description"
										class="text-xs text-muted-foreground"
									>
										Sync downloads and continue unfinished transfers in the background.
									</p>
								</div>
								<Switch
									id="background-refresh"
									bind:checked={backgroundRefresh}
									aria-describedby="background-refresh-description"
								/>
							</div>
						</div>
					</section>
				</TabsContent>

				<TabsContent value="data" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
							Account storage
						</h4>
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="border-border-color bg-bg-color rounded-lg border p-4">
								<p class="text-xs uppercase text-muted-foreground">Watchlist items</p>
								<p class="text-text-color text-2xl font-semibold">{watchlistCount}</p>
							</div>
							<div class="border-border-color bg-bg-color rounded-lg border p-4">
								<p class="text-xs uppercase text-muted-foreground">History entries</p>
								<p class="text-text-color text-2xl font-semibold">{historyCount}</p>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-3">
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
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
						<h4 class="text-text-color text-xs font-semibold uppercase tracking-wider">
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

