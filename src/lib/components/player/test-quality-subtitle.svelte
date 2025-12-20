<script lang="ts">
	import QualitySelector from './QualitySelector.svelte';
	import SubtitleSelector from './SubtitleSelector.svelte';
	import PlayerControls from './PlayerControls.svelte';
	import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';

	// Mock data for testing
	const mockQualities: VideoQuality[] = [
		{ label: 'Auto', resolution: 'Auto', url: 'https://example.com/auto.m3u8', isDefault: true },
		{ label: '360p', resolution: '360p', url: 'https://example.com/360p.m3u8' },
		{ label: '480p', resolution: '480p', url: 'https://example.com/480p.m3u8' },
		{ label: '720p', resolution: '720p', url: 'https://example.com/720p.m3u8' },
		{ label: '1080p', resolution: '1080p', url: 'https://example.com/1080p.m3u8' },
		{ label: '4K Ultra HD', resolution: '4K', url: 'https://example.com/4k.m3u8' }
	];

	const mockSubtitles: SubtitleTrack[] = [
		{ id: 'en', label: 'English', language: 'en', url: 'https://example.com/en.vtt', isDefault: true },
		{ id: 'es', label: 'Español', language: 'es', url: 'https://example.com/es.vtt' },
		{ id: 'fr', label: 'Français', language: 'fr', url: 'https://example.com/fr.vtt' }
	];

	let selectedQuality = $state('auto');
	let selectedSubtitle = $state<string | undefined>(undefined);

	function handleQualityChange(quality: VideoQuality) {
		console.log('Quality changed to:', quality.label);
		selectedQuality = quality.label;
	}

	function handleSubtitleChange(subtitle: SubtitleTrack | null) {
		console.log('Subtitle changed to:', subtitle ? subtitle.label : 'Off');
		selectedSubtitle = subtitle?.id;
	}
</script>

<div class="p-6 bg-background text-foreground min-h-screen">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-2xl font-bold mb-6">Player Quality & Subtitle Test</h1>
			
			<div class="mb-8 p-6 border rounded-lg bg-muted/20">
				<h2 class="text-lg font-semibold mb-4">Quality Selector</h2>
				<QualitySelector
					qualities={mockQualities}
					selectedQuality={selectedQuality}
					onQualityChange={handleQualityChange}
				/>
			</div>

			<div class="mb-8 p-6 border rounded-lg bg-muted/20">
				<h2 class="text-lg font-semibold mb-4">Subtitle Selector</h2>
				<SubtitleSelector
					subtitles={mockSubtitles}
					selectedSubtitle={selectedSubtitle}
					onSubtitleChange={handleSubtitleChange}
				/>
			</div>

			<div class="mb-8 p-6 border rounded-lg bg-muted/20">
				<h2 class="text-lg font-semibold mb-4">Combined Player Controls</h2>
				<PlayerControls
					qualities={mockQualities}
					subtitles={mockSubtitles}
					selectedQuality={selectedQuality}
					selectedSubtitle={selectedSubtitle}
					onQualityChange={handleQualityChange}
					onSubtitleChange={handleSubtitleChange}
				/>
			</div>

			<div class="p-4 bg-muted rounded-lg">
				<h3 class="font-semibold mb-2">Current State</h3>
				<div class="space-y-2 text-sm">
					<p><strong>Selected Quality:</strong> {selectedQuality}</p>
					<p><strong>Selected Subtitle:</strong> {selectedSubtitle || 'None'}</p>
				</div>
			</div>
		</div>
	</div>
