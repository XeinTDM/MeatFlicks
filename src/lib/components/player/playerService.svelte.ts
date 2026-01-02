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
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	init() {
		if (typeof window === 'undefined') return;

		this.messageHandler = (event: MessageEvent) => {
			if (!event.origin.includes(window.location.hostname) && event.origin !== 'null') {
				return;
			}

			const data = event.data;
			if (data && typeof data === 'object') {
				if (data.type === 'progressUpdate' && typeof data.progress === 'number') {
					this.currentProgress = data.progress;
				}
			}
		};

		window.addEventListener('message', this.messageHandler);
	}

	postToIframe(message: any) {
		if (this.iframeElement?.contentWindow) {
			this.iframeElement.contentWindow.postMessage(message, '*');
		}
	}

	handleQualityChange = (quality: VideoQuality, qualities: VideoQuality[]) => {
		this.selectedQuality = quality.label;
		if (qualities.some((q) => q.url === quality.url)) {
			this.postToIframe({
				type: 'qualityChange',
				quality: quality.url
			});
		}
	};

	handleSubtitleChange = (subtitle: SubtitleTrack | null) => {
		this.selectedSubtitle = subtitle?.id || null;
		this.postToIframe({
			type: 'subtitleChange',
			subtitle: subtitle
				? {
					url: subtitle.url,
					language: subtitle.language,
					label: subtitle.label
				}
				: null
		});
	};

	handleIframeLoad = (qualities: VideoQuality[], subtitles: SubtitleTrack[]) => {
		let qualityValue = 'auto';
		if (this.selectedQuality !== 'auto') {
			const quality = qualities.find((q) => q.label === this.selectedQuality);
			if (quality) {
				qualityValue = quality.url;
			}
		}

		this.postToIframe({
			type: 'qualityChange',
			quality: qualityValue
		});

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

		this.postToIframe({
			type: 'subtitleChange',
			subtitle: subtitleValue
		});
	};

	handlePlaybackSpeedChange = (speed: number) => {
		this.playbackSpeed = Math.min(2.0, Math.max(0.25, speed));
		this.postToIframe({
			type: 'playbackSpeedChange',
			speed: this.playbackSpeed
		});
	};

	seekTo = (seconds: number) => {
		this.postToIframe({
			type: 'seek',
			time: seconds
		});
	};

	startProgressTracking = (
		durationMinutes: number | null,
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

	destroy() {
		this.cleanup();
		if (this.messageHandler && typeof window !== 'undefined') {
			window.removeEventListener('message', this.messageHandler);
		}
	}

	cleanup = () => {
		this.stopProgressTracking();
		this.cancelAutoPlay();
	};
}
