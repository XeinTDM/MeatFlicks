import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';

export function createPlayerService() {
    let isTheaterMode = false;
    let playbackSpeed = 1.0;
    let iframeElement: HTMLIFrameElement | null = null;
    let selectedQuality: string = 'auto';
    let selectedSubtitle: string | null = null;
    let isAutoPlay = true;
    let showNextOverlay = false;
    let currentProgress = 0;

    let nextEpTimer: ReturnType<typeof setTimeout> | null = null;
    let autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
    let progressSaveInterval: ReturnType<typeof setInterval> | null = null;

    function toggleTheaterMode() {
        isTheaterMode = !isTheaterMode;
    }

    function togglePictureInPicture() {
        if (!iframeElement || typeof document === 'undefined') return;

        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        } else if (iframeElement.contentWindow) {
            try {
                iframeElement.contentWindow.document.querySelector('video')?.requestPictureInPicture();
            } catch (error) {
                console.error('Picture-in-Picture not supported:', error);
            }
        }
    }

    function handleQualityChange(quality: VideoQuality, qualities: VideoQuality[]) {
        selectedQuality = quality.label;
        if (qualities.some((q) => q.url === quality.url) && iframeElement?.contentWindow) {
            iframeElement.contentWindow.postMessage(
                {
                    type: 'qualityChange',
                    quality: quality.url
                },
                '*'
            );
        }
    }

    function handleSubtitleChange(subtitle: SubtitleTrack | null) {
        selectedSubtitle = subtitle?.id || null;
        if (iframeElement?.contentWindow) {
            iframeElement.contentWindow.postMessage(
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
    }

    function handleIframeLoad(qualities: VideoQuality[], subtitles: SubtitleTrack[]) {
        if (!iframeElement?.contentWindow) return;

        // Set initial quality
        let qualityValue = 'auto';
        if (selectedQuality !== 'auto') {
            const quality = qualities.find((q) => q.label === selectedQuality);
            if (quality) {
                qualityValue = quality.url;
            }
        }

        iframeElement.contentWindow.postMessage(
            {
                type: 'qualityChange',
                quality: qualityValue
            },
            '*'
        );

        // Set initial subtitle
        let subtitleValue = null;
        if (selectedSubtitle) {
            const subtitle = subtitles.find((s) => s.id === selectedSubtitle);
            if (subtitle) {
                subtitleValue = {
                    url: subtitle.url,
                    language: subtitle.language,
                    label: subtitle.label
                };
            }
        }

        iframeElement.contentWindow.postMessage(
            {
                type: 'subtitleChange',
                subtitle: subtitleValue
            },
            '*'
        );
    }

    function handlePlaybackSpeedChange(speed: number) {
        playbackSpeed = Math.min(2.0, Math.max(0.25, speed));
        if (iframeElement?.contentWindow) {
            iframeElement.contentWindow.postMessage(
                {
                    type: 'playbackSpeedChange',
                    speed: playbackSpeed
                },
                '*'
            );
        }
    }

    function startProgressTracking(
        mediaId: string,
        mediaType: 'movie' | 'tv',
        durationMinutes: number | null,
        seasonNumber: number | null,
        episodeNumber: number | null,
        onProgressSave: (progress: number) => Promise<void>
    ) {
        stopProgressTracking();

        if (!durationMinutes) return;

        progressSaveInterval = setInterval(async () => {
            try {
                const duration = durationMinutes * 60;
                if (duration > 0) {
                    await onProgressSave(currentProgress);
                }
            } catch (error) {
                console.error('Failed to save playback progress:', error);
            }
        }, 30000);
    }

    function stopProgressTracking() {
        if (progressSaveInterval) {
            clearInterval(progressSaveInterval);
            progressSaveInterval = null;
        }
    }

    function setupAutoPlayTimer(durationMinutes: number | null, onNextEpisode: () => void) {
        cancelAutoPlay();

        if (!durationMinutes || !isAutoPlay) return;

        const durationMs = durationMinutes * 60 * 1000;
        const triggerTime = Math.max(0, durationMs - 30000);

        if (durationMs > 30000) {
            nextEpTimer = setTimeout(() => {
                showNextOverlay = true;
                autoPlayTimer = setTimeout(() => {
                    onNextEpisode();
                }, 30000);
            }, triggerTime);
        }
    }

    function cancelAutoPlay() {
        if (autoPlayTimer) {
            clearTimeout(autoPlayTimer);
            autoPlayTimer = null;
        }
        if (nextEpTimer) {
            clearTimeout(nextEpTimer);
            nextEpTimer = null;
        }
        showNextOverlay = false;
    }

    function cleanup() {
        stopProgressTracking();
        cancelAutoPlay();
    }

    return {
        get isTheaterMode() {
            return isTheaterMode;
        },
        get playbackSpeed() {
            return playbackSpeed;
        },
        get iframeElement() {
            return iframeElement;
        },
        get selectedQuality() {
            return selectedQuality;
        },
        get selectedSubtitle() {
            return selectedSubtitle;
        },
        get isAutoPlay() {
            return isAutoPlay;
        },
        get showNextOverlay() {
            return showNextOverlay;
        },
        get currentProgress() {
            return currentProgress;
        },
        set iframeElement(element: HTMLIFrameElement | null) {
            iframeElement = element;
        },
        set currentProgress(progress: number) {
            currentProgress = progress;
        },
        set isAutoPlay(value: boolean) {
            isAutoPlay = value;
        },
        toggleTheaterMode,
        togglePictureInPicture,
        handleQualityChange,
        handleSubtitleChange,
        handleIframeLoad,
        handlePlaybackSpeedChange,
        startProgressTracking,
        stopProgressTracking,
        setupAutoPlayTimer,
        cancelAutoPlay,
        cleanup
    };
}

export type PlayerService = ReturnType<typeof createPlayerService>;
