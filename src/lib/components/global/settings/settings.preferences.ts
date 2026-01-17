import { preferences, type AppPreferences } from '$lib/state/stores/preferencesStore';

export type SettingsTab = 'appearance' | 'playback' | 'notifications' | 'downloads' | 'data';

export type BooleanPreferenceKey = {
	[K in keyof AppPreferences]: AppPreferences[K] extends boolean ? K : never;
}[keyof AppPreferences];

export type PreferenceToggle = {
	key: BooleanPreferenceKey;
	label: string;
	description: string;
};

export const appearanceToggles: PreferenceToggle[] = [
	{
		key: 'showBackdropAnimations',
		label: 'Backdrop animations',
		description: 'Enable ambient motion on hero art and collection pages.'
	},
	{
		key: 'showEpisodeBadges',
		label: 'Episode badges',
		description: 'Highlight episodes that are new, trending, or expiring soon.'
	},
	{
		key: 'compactSidebar',
		label: 'Compact sidebar',
		description: 'Reduce navigation spacing to show more rows at a glance.'
	},
	{
		key: 'emphasizeAccessibility',
		label: 'Accessibility emphasis',
		description: 'Boost contrast and reduce animations for easier reading.'
	},
	{
		key: 'focusCollections',
		label: 'Collections spotlight',
		description: 'Keep curated collections pinned at the top of navigation.'
	},
	{
		key: 'hideSpoilers',
		label: 'Blur spoilers',
		description: 'Mask text that could reveal plot twists until you tap to reveal.'
	}
];

export const playbackFlowToggles: PreferenceToggle[] = [
	{
		key: 'autoplayNext',
		label: 'Autoplay next episode',
		description: 'Start the next chapter automatically once you finish the current one.'
	},
	{
		key: 'autoplayTrailers',
		label: 'Autoplay trailers',
		description: 'Show previews while browsing titles to help you decide.'
	},
	{
		key: 'skipIntros',
		label: 'Skip intros automatically',
		description: 'Jump past opening credits when a show supports it.'
	},
	{
		key: 'rememberPlaybackPosition',
		label: 'Remember playback position',
		description: 'Continue from where you left off across devices and sessions.'
	}
];

export const playbackEnhancementToggles: PreferenceToggle[] = [
	{
		key: 'cinematicPlayback',
		label: 'Cinematic playback',
		description: 'Apply letterboxing and tuned audio cues for large displays.'
	},
	{
		key: 'reduceBuffering',
		label: 'Reduce buffering',
		description: 'Limit aggressive prefetch to keep latency low on shared networks.'
	}
];

export const bandwidthToggles: PreferenceToggle[] = [
	{
		key: 'limitCellularData',
		label: 'Limit cellular data',
		description: 'Lower the streaming tier when you are on mobile networks.'
	},
	{
		key: 'adaptiveAudio',
		label: 'Adaptive audio',
		description: 'Dynamic bitrate scaling for smoother playback in crowded networks.'
	}
];

export const notificationUpdateToggles: PreferenceToggle[] = [
	{
		key: 'emailUpdates',
		label: 'Email updates',
		description: 'Get new release emails tailored to your watchlist.'
	},
	{
		key: 'pushReminders',
		label: 'Push reminders',
		description: 'Receive optional push reminders when your favorites refresh.'
	},
	{
		key: 'releaseReminders',
		label: 'Release reminders',
		description: 'Alert me when new seasons or movies I follow go live.'
	}
];

export const notificationAlertToggles: PreferenceToggle[] = [
	{
		key: 'weeklyDigest',
		label: 'Weekly digest',
		description: 'A curated recap of releases, recommendations, and updates each Friday.'
	},
	{
		key: 'watchlistAlerts',
		label: 'Watchlist alerts',
		description: 'Notify me when shows from my watchlist start streaming.'
	},
	{
		key: 'productAnnouncements',
		label: 'Product announcements',
		description: 'Hear about new features, betas, and community events.'
	},
	{
		key: 'betaAnnouncements',
		label: 'Beta announcements',
		description: 'Learn about experimental features before the public launch.'
	}
];

export const downloadSmartToggles: PreferenceToggle[] = [
	{
		key: 'autoDownloadNewEpisodes',
		label: 'Auto download next episodes',
		description: 'Fetch the next episode while you finish the current one.'
	},
	{
		key: 'autoDeleteFinishedDownloads',
		label: 'Auto delete finished downloads',
		description: 'Free up space after you complete an episode or film.'
	}
];

export const downloadNetworkToggles: PreferenceToggle[] = [
	{
		key: 'wifiOnlyDownloads',
		label: 'Wi-Fi only downloads',
		description: 'Prevent downloads from starting on cellular connections.'
	},
	{
		key: 'backgroundRefresh',
		label: 'Background refresh',
		description: 'Sync downloads and resume transfers even when the app is minimized.'
	}
];

export const downloadStorageToggles: PreferenceToggle[] = [
	{
		key: 'limitDownloadSize',
		label: 'Limit download size',
		description: 'Cap per-file sizes so downloads never overwhelm your storage.'
	},
	{
		key: 'autoManageDownloads',
		label: 'Auto-manage cache',
		description: 'Evict idle downloads first when space runs low.'
	}
];

export const dataToggles: PreferenceToggle[] = [
	{
		key: 'autoSyncWatchlist',
		label: 'Auto-sync watchlist',
		description: 'Mirror watchlist changes across your devices automatically.'
	}
];

export const playbackQualityOptions = [
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
] as const satisfies readonly { value: AppPreferences['playbackQuality']; label: string; description: string }[];

export const handleBooleanPreferenceChange =
	(key: BooleanPreferenceKey) =>
		(value: boolean | Event) => {
			const checked =
				typeof value === 'boolean'
					? value
					: (value.currentTarget as HTMLInputElement).checked;
			preferences.setPreference(key, checked);
		};

export const updatePlaybackQuality = (value: AppPreferences['playbackQuality']) => {
	preferences.setPreference('playbackQuality', value);
};
