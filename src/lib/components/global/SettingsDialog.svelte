<script lang="ts">
import { onDestroy } from 'svelte';
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
import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
import { watchHistory } from '$lib/state/stores/historyStore';
import { preferences, type AppPreferences, DEFAULT_PREFERENCES } from '$lib/state/stores/preferencesStore';
import {
	appearanceToggles,
	bandwidthToggles,
	dataToggles,
	downloadNetworkToggles,
	downloadSmartToggles,
	downloadStorageToggles,
	handleBooleanPreferenceChange,
	notificationAlertToggles,
	notificationUpdateToggles,
	playbackEnhancementToggles,
	playbackFlowToggles,
	playbackQualityOptions,
	updatePlaybackQuality
} from './settings/settings.preferences';
import {
	clearWatchHistoryData,
	clearWatchlistData,
	exportUserData,
	importUserData,
	resetPreferencesData
} from './settings/settings.actions';
import type { DataNotice } from './settings/settings.actions';
import type { SettingsTab, BooleanPreferenceKey } from './settings/settings.preferences';

let { open = $bindable(false) } = $props<{ open?: boolean }>();

let importInput = $state<HTMLInputElement | null>(null);
let settingsTab = $state<SettingsTab>('appearance');
let dataNotice = $state<DataNotice | null>(null);
let preferencesSnapshot = $state<AppPreferences>(DEFAULT_PREFERENCES);
const unsubscribePreferences = preferences.subscribe((value) => {
	preferencesSnapshot = value;
});
onDestroy(() => {
	unsubscribePreferences();
});

const watchlistState = $derived(watchlist.items);
const historyCount = $derived(watchHistory.entries.length);
const watchlistCount = $derived(watchlistState.length);

const prefInputId = (key: BooleanPreferenceKey) => `settings-${key}`;
const prefDescriptionId = (key: BooleanPreferenceKey) => `${prefInputId(key)}-description`;

const resetPreferences = () => {
	dataNotice = resetPreferencesData();
};

const clearWatchlist = () => {
	dataNotice = clearWatchlistData();
};

const clearWatchHistory = () => {
	dataNotice = clearWatchHistoryData();
};

const handleExport = async () => {
	dataNotice = await exportUserData();
};

const triggerImport = () => {
	dataNotice = null;
	importInput?.click();
};

const handleImport = async (event: Event) => {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];

	if (!file) return;

	dataNotice = await importUserData(file);
	input.value = '';
};
</script>

<Dialog bind:open>
	<DialogContent
		id="settings-dialog"
		class="grid h-[85vh] w-[min(96vw,1200px)] max-w-300 grid-rows-[auto,1fr] overflow-hidden border border-border bg-card text-foreground sm:w-[min(94vw,1400px)] lg:w-[min(90vw,1600px)]"
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
				<TabsList
					class="grid w-full grid-cols-2 gap-2 overflow-x-auto sm:grid-cols-3 md:grid-cols-5"
				>
					<TabsTrigger value="appearance">Appearance</TabsTrigger>
					<TabsTrigger value="playback">Playback</TabsTrigger>
					<TabsTrigger value="notifications">Notifications</TabsTrigger>
					<TabsTrigger value="downloads">Downloads</TabsTrigger>
					<TabsTrigger value="data">Data &amp; privacy</TabsTrigger>
				</TabsList>

				<TabsContent value="appearance" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">Theme</h4>
						<div class="flex w-fit rounded-md border border-border bg-background p-0.5">
							<Button onclick={toggleMode} variant="outline" size="icon" aria-label="Toggle theme">
								<Sun
									class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90"
								/>
								<Moon
									class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0"
								/>
								<span class="sr-only">Toggle theme</span>
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							MeatFlicks loads in dark mode by default; toggle to switch back to light.
						</p>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Interface
						</h4>
						<div class="space-y-3">
							{#each appearanceToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
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
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Playback flow
						</h4>
						<div class="space-y-3">
							{#each playbackFlowToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Playback enhancements
						</h4>
						<div class="space-y-3">
							{#each playbackEnhancementToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Streaming quality
						</h4>
						<p class="text-xs text-muted-foreground">
							Choose how MeatFlicks balances quality and bandwidth for your account.
						</p>
						<div class="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
							{#each playbackQualityOptions as option (option.value)}
								<Button
									type="button"
									variant={
										preferencesSnapshot.playbackQuality === option.value
											? 'secondary'
											: 'outline'
									}
									class="flex h-auto flex-col items-start gap-1 text-left whitespace-normal"
									aria-pressed={preferencesSnapshot.playbackQuality === option.value}
									onclick={() => updatePlaybackQuality(option.value)}
								>
									<span class="text-sm font-medium">{option.label}</span>
									<span class="text-xs text-muted-foreground">{option.description}</span>
								</Button>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Bandwidth
						</h4>
						<div class="space-y-3">
							{#each bandwidthToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>
				</TabsContent>

				<TabsContent value="notifications" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Email &amp; push
						</h4>
						<div class="space-y-3">
							{#each notificationUpdateToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Personalized alerts
						</h4>
						<div class="space-y-3">
							{#each notificationAlertToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>
				</TabsContent>

				<TabsContent value="downloads" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Smart downloads
						</h4>
						<div class="space-y-3">
							{#each downloadSmartToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Storage optimization
						</h4>
						<div class="space-y-3">
							{#each downloadStorageToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-4">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Network usage
						</h4>
						<div class="space-y-3">
							{#each downloadNetworkToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>
				</TabsContent>

				<TabsContent value="data" class="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
					<section class="space-y-3">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Account storage
						</h4>
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="rounded-lg border border-border bg-background p-4">
								<p class="text-xs text-muted-foreground uppercase">Watchlist items</p>
								<p class="text-2xl font-semibold text-foreground">{watchlistCount}</p>
							</div>
							<div class="rounded-lg border border-border bg-background p-4">
								<p class="text-xs text-muted-foreground uppercase">History entries</p>
								<p class="text-2xl font-semibold text-foreground">{historyCount}</p>
							</div>
						</div>
					</section>

					<Separator />

					<section class="space-y-3">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
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
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Data syncing
						</h4>
						<div class="space-y-3">
							{#each dataToggles as toggle (toggle.key)}
								<div class="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
									<div class="space-y-1">
										<Label
											for={prefInputId(toggle.key)}
											class="text-sm font-medium text-foreground"
										>
											{toggle.label}
										</Label>
										<p
											id={prefDescriptionId(toggle.key)}
											class="text-xs text-muted-foreground"
										>
											{toggle.description}
										</p>
									</div>
									<Switch
										id={prefInputId(toggle.key)}
										checked={preferencesSnapshot[toggle.key]}
										onCheckedChange={handleBooleanPreferenceChange(toggle.key)}
										aria-describedby={prefDescriptionId(toggle.key)}
									/>
								</div>
							{/each}
						</div>
					</section>

					<Separator />

					<section class="space-y-3">
						<h4 class="text-xs font-semibold tracking-wider text-foreground uppercase">
							Quick cleanup
						</h4>
						<div class="grid gap-2 sm:grid-cols-2">
							<Button variant="outline" class="justify-start gap-2" onclick={clearWatchlist}>
								<ListX class="h-4 w-4" />
								Clear watchlist
							</Button>
							<Button variant="destructive" class="justify-start gap-2" onclick={clearWatchHistory}>
								<Trash2 class="h-4 w-4" />
								Clear watch history
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							Clearing data removes it from this device. Export your data first if you want a
							backup.
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
