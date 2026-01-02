import { untrack } from 'svelte';
import type { ProviderResolution } from './provider-registry';
import type { StreamingSource, VideoQuality, SubtitleTrack, MediaType } from './types';

export type { MediaType };

type StreamingState = {
	source: StreamingSource | null;
	resolutions: ProviderResolution[];
	qualities: VideoQuality[];
	subtitles: SubtitleTrack[];
	isResolving: boolean;
	error: string | null;
};

type EpisodeInfo = {
	season?: number;
	episode?: number;
};

type CurrentMedia = {
	mediaId: string | null;
	tmdbId: number | null;
	mediaType: MediaType | null;
	episodeInfo: EpisodeInfo;
};

export class StreamingService {
	state = $state<StreamingState>({
		source: null,
		resolutions: [],
		qualities: [],
		subtitles: [],
		isResolving: false,
		error: null
	});

	currentProviderId = $state<string | null>(null);
	currentMedia = $state<CurrentMedia>({
		mediaId: null,
		tmdbId: null,
		mediaType: null,
		episodeInfo: {}
	});

	isResolved = $derived(
		Boolean(this.state.source?.embedUrl ?? this.state.source?.streamUrl)
	);

	hasResolutions = $derived(this.state.resolutions.length > 0);

	resolveProvider = async (
		providerId: string,
		options: {
			tmdbId: number;
			mediaType: MediaType;
			imdbId?: string;
			malId?: number;
			subOrDub?: 'sub' | 'dub';
			season?: number;
			episode?: number;
			preferredQuality?: string;
			preferredSubtitleLanguage?: string | null;
			csrfToken?: string;
			startAt?: number;
			sub_file?: string;
			sub_label?: string;
		}
	) => {
		if (!options.tmdbId) {
			this.state.error = 'No TMDB ID provided';
			return;
		}

		this.state.isResolving = true;
		this.state.error = null;

		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (options.csrfToken) {
				headers['X-CSRF-Token'] = options.csrfToken;
			}

			const response = await fetch('/api/streaming', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					mediaType: options.mediaType,
					tmdbId: options.tmdbId,
					imdbId: options.imdbId,
					malId: options.malId,
					subOrDub: options.subOrDub,
					season: options.season,
					episode: options.episode,
					preferredQuality: options.preferredQuality,
					preferredSubtitleLanguage: options.preferredSubtitleLanguage,
					includeQualities: true,
					includeSubtitles: true,
					preferredProviders: providerId ? [providerId] : undefined,
					startAt: options.startAt,
					sub_file: options.sub_file,
					sub_label: options.sub_label
				}),
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}

			const payload = await response.json();

			this.state.source = payload?.source ?? null;
			this.state.resolutions = Array.isArray(payload?.resolutions) ? [...payload.resolutions] : [];

			if (payload.source) {
				this.state.qualities = payload.source.qualities || [];
				this.state.subtitles = payload.source.subtitles || [];
			}

			if (!this.state.source) {
				this.state.error = 'Provider did not return a playable stream. Please try another option.';
			}

			this.currentProviderId = this.state.source?.providerId ?? null;
		} catch (error) {
			console.error('[streaming][resolveProvider]', error);
			this.state.error = error instanceof Error ? error.message : 'Failed to load provider stream.';
		} finally {
			this.state.isResolving = false;
		}
	};

	setCurrentMedia = (mediaInfo: {
		mediaId: string;
		tmdbId: number | null;
		mediaType: MediaType;
		season?: number;
		episode?: number;
	}) => {
		this.currentMedia = {
			mediaId: mediaInfo.mediaId,
			tmdbId: mediaInfo.tmdbId,
			mediaType: mediaInfo.mediaType,
			episodeInfo: {
				season: mediaInfo.season,
				episode: mediaInfo.episode
			}
		};
	};

	selectProvider = (providerId: string) => {
		if (this.currentProviderId === providerId) return;
		this.currentProviderId = providerId;
		this.state.error = null;
	};

	initializeFromServerData = (serverData: {
		source?: StreamingSource | null;
		resolutions?: ProviderResolution[];
	}) => {
		untrack(() => {
			if (serverData.source) {
				this.state.source = serverData.source;
				this.state.qualities = serverData.source.qualities || [];
				this.state.subtitles = serverData.source.subtitles || [];
				this.currentProviderId = serverData.source.providerId;
			}

			if (serverData.resolutions && serverData.resolutions.length > 0) {
				this.state.resolutions = [...serverData.resolutions];
			} else {
				console.log('[DEBUG] No resolutions to set from server data');
			}
		});
	};

	reset = () => {
		this.state.source = null;
		this.state.resolutions = [];
		this.state.qualities = [];
		this.state.subtitles = [];
		this.state.isResolving = false;
		this.state.error = null;
		this.currentProviderId = null;
	};
}
