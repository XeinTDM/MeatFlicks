import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';

export class PlayerService {
    playbackSpeed = $state(1.0);
    iframeElement = $state<HTMLIFrameElement | null>(null);
    selectedQuality = $state('auto');
    selectedSubtitle = $state<string | null>(null);
    isAutoPlay = $state(true);
    showNextOverlay = $state(false);
    currentProgress = $state(0);

    private nextEpTimer: ReturnType<typeof setTimeout> | null = null;
    private autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
    private progressSaveInterval: ReturnType<typeof setInterval> | null = null;

    handleQualityChange = (quality: VideoQuality, qualities: VideoQuality[]) => {
        this.selectedQuality = quality.label;
        if (qualities.some((q) => q.url === quality.url) && this.iframeElement?.contentWindow) {
            this.iframeElement.contentWindow.postMessage(
                {
                    type: 'qualityChange',
                    quality: quality.url
                },
                '*'
            );
        }
    };

    handleSubtitleChange = (subtitle: SubtitleTrack | null) => {
        this.selectedSubtitle = subtitle?.id || null;
        if (this.iframeElement?.contentWindow) {
            this.iframeElement.contentWindow.postMessage(
                {
                    type: 'subtitleChange',
                    subtitle: subtitle
                        ? {
                            url: subtitle.url,
                            language: subtitle.language,
                            label: subtitle.label
                        }
                        : null
                },
                '*'
            );
        }
    };

    handleIframeLoad = (qualities: VideoQuality[], subtitles: SubtitleTrack[]) => {
        if (!this.iframeElement?.contentWindow) return;

        let qualityValue = 'auto';
        if (this.selectedQuality !== 'auto') {
            const quality = qualities.find((q) => q.label === this.selectedQuality);
            if (quality) {
                qualityValue = quality.url;
            }
        }

        this.iframeElement.contentWindow.postMessage(
            {
                type: 'qualityChange',
                quality: qualityValue
            },
            '*'
        );

        let subtitleValue = null;
        if (this.selectedSubtitle) {
            const subtitle = subtitles.find((s) => s.id === this.selectedSubtitle);
            if (subtitle) {
                subtitleValue = {
                    url: subtitle.url,
                    language: subtitle.language,
                    label: subtitle.label
                };
            }
        }

        this.iframeElement.contentWindow.postMessage(
            {
                type: 'subtitleChange',
                subtitle: subtitleValue
            },
            '*'
        );
    };

    handlePlaybackSpeedChange = (speed: number) => {
        this.playbackSpeed = Math.min(2.0, Math.max(0.25, speed));
        if (this.iframeElement?.contentWindow) {
            this.iframeElement.contentWindow.postMessage(
                {
                    type: 'playbackSpeedChange',
                    speed: this.playbackSpeed
                },
                '*'
            );
        }
    };

    startProgressTracking = (
        mediaId: string,
        mediaType: 'movie' | 'tv' | 'anime',
        durationMinutes: number | null,
        seasonNumber: number | null,
        episodeNumber: number | null,
        onProgressSave: (progress: number) => Promise<void>
    ) => {
        this.stopProgressTracking();

        if (!durationMinutes) return;

        this.progressSaveInterval = setInterval(async () => {
            try {
                const duration = durationMinutes * 60;
                if (duration > 0) {
                    await onProgressSave(this.currentProgress);
                }
            } catch (error) {
                console.error('Failed to save playback progress:', error);
            }
        }, 30000);
    };

    stopProgressTracking = () => {
        if (this.progressSaveInterval) {
            clearInterval(this.progressSaveInterval);
            this.progressSaveInterval = null;
        }
    };

    setupAutoPlayTimer = (durationMinutes: number | null, onNextEpisode: () => void) => {
        this.cancelAutoPlay();

        if (!durationMinutes || !this.isAutoPlay) return;

        const durationMs = durationMinutes * 60 * 1000;
        const triggerTime = Math.max(0, durationMs - 30000);

        if (durationMs > 30000) {
            this.nextEpTimer = setTimeout(() => {
                this.showNextOverlay = true;
                this.autoPlayTimer = setTimeout(() => {
                    onNextEpisode();
                }, 30000);
            }, triggerTime);
        }
    };

    cancelAutoPlay = () => {
        if (this.autoPlayTimer) {
            clearTimeout(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
        if (this.nextEpTimer) {
            clearTimeout(this.nextEpTimer);
            this.nextEpTimer = null;
        }
        this.showNextOverlay = false;
    };

    cleanup = () => {
        this.stopProgressTracking();
        this.cancelAutoPlay();
    };
}
