import type { ProviderResolution } from './provider-registry';
import type { StreamingSource, VideoQuality, SubtitleTrack } from './types';

export type MediaType = 'movie' | 'tv';

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

export function createStreamingService() {
    let state: StreamingState = {
        source: null,
        resolutions: [],
        qualities: [],
        subtitles: [],
        isResolving: false,
        error: null
    };

    let currentProviderId: string | null = null;
    let currentMedia: CurrentMedia = {
        mediaId: null,
        tmdbId: null,
        mediaType: null,
        episodeInfo: {}
    };

    async function resolveProvider(
        providerId: string,
        options: {
            tmdbId: number;
            mediaType: MediaType;
            imdbId?: string;
            season?: number;
            episode?: number;
            preferredQuality?: string;
            preferredSubtitleLanguage?: string | null;
            csrfToken?: string;
        }
    ) {
        if (!options.tmdbId) {
            state.error = 'No TMDB ID provided';
            return;
        }

        state.isResolving = true;
        state.error = null;

        try {
            const response = await fetch('/api/streaming', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mediaType: options.mediaType,
                    tmdbId: options.tmdbId,
                    imdbId: options.imdbId,
                    season: options.season,
                    episode: options.episode,
                    preferredQuality: options.preferredQuality,
                    preferredSubtitleLanguage: options.preferredSubtitleLanguage,
                    includeQualities: true,
                    includeSubtitles: true,
                    preferredProviders: providerId ? [providerId] : undefined,
                    csrf_token: options.csrfToken
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const payload = await response.json();

            state.source = payload?.source ?? null;
            state.resolutions = Array.isArray(payload?.resolutions) ? [...payload.resolutions] : [];

            if (payload.source) {
                state.qualities = payload.source.qualities || [];
                state.subtitles = payload.source.subtitles || [];
            }

            if (!state.source) {
                state.error = 'Provider did not return a playable stream. Please try another option.';
            }

            currentProviderId = state.source?.providerId ?? null;
        } catch (error) {
            console.error('[streaming][resolveProvider]', error);
            state.error = error instanceof Error ? error.message : 'Failed to load provider stream.';
        } finally {
            state.isResolving = false;
        }
    }

    function setCurrentMedia(mediaInfo: {
        mediaId: string;
        tmdbId: number | null;
        mediaType: MediaType;
        season?: number;
        episode?: number;
    }) {
        currentMedia = {
            mediaId: mediaInfo.mediaId,
            tmdbId: mediaInfo.tmdbId,
            mediaType: mediaInfo.mediaType,
            episodeInfo: {
                season: mediaInfo.season,
                episode: mediaInfo.episode
            }
        };
    }

    function selectProvider(providerId: string) {
        if (currentProviderId === providerId) return;
        currentProviderId = providerId;
        state.error = null;
    }

    function reset() {
        state = {
            source: null,
            resolutions: [],
            qualities: [],
            subtitles: [],
            isResolving: false,
            error: null
        };
        currentProviderId = null;
    }

    return {
        get state() {
            return state;
        },
        get currentProviderId() {
            return currentProviderId;
        },
        get currentMedia() {
            return currentMedia;
        },
        resolveProvider,
        setCurrentMedia,
        selectProvider,
        reset
    };
}

export type StreamingService = ReturnType<typeof createStreamingService>;
