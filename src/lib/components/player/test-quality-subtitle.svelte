<script lang="ts">
	import QualitySelector from './QualitySelector.svelte';
	import SubtitleSelector from './SubtitleSelector.svelte';
	import PlayerControls from './PlayerControls.svelte';
	import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';

	const mockQualities: VideoQuality[] = [
		{ label: 'Auto', resolution: 'Auto', url: 'https://example.com/auto.m3u8', isDefault: true },
		{ label: '360p', resolution: '360p', url: 'https://example.com/360p.m3u8' },
		{ label: '480p', resolution: '480p', url: 'https://example.com/480p.m3u8' },
		{ label: '720p', resolution: '720p', url: 'https://example.com/720p.m3u8' },
		{ label: '1080p', resolution: '1080p', url: 'https://example.com/1080p.m3u8' },
		{ label: '4K Ultra HD', resolution: '4K', url: 'https://example.com/4k.m3u8' }
	];

	const mockSubtitles: SubtitleTrack[] = [
		{
			id: 'en',
			label: 'English',
			language: 'en',
			url: 'https://example.com/en.vtt',
			isDefault: true
		},
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

<div class="min-h-screen bg-background p-6 text-foreground">
	<div class="mx-auto max-w-4xl">
		<h1 class="mb-6 text-2xl font-bold">Player Quality & Subtitle Test</h1>

		<div class="mb-8 rounded-lg border bg-muted/20 p-6">
			<h2 class="mb-4 text-lg font-semibold">Quality Selector</h2>
			<QualitySelector
				qualities={mockQualities}
				{selectedQuality}
				onQualityChange={handleQualityChange}
			/>
		</div>

		<div class="mb-8 rounded-lg border bg-muted/20 p-6">
			<h2 class="mb-4 text-lg font-semibold">Subtitle Selector</h2>
			<SubtitleSelector
				subtitles={mockSubtitles}
				{selectedSubtitle}
				onSubtitleChange={handleSubtitleChange}
			/>
		</div>

		<div class="mb-8 rounded-lg border bg-muted/20 p-6">
			<h2 class="mb-4 text-lg font-semibold">Combined Player Controls</h2>
			<PlayerControls
				qualities={mockQualities}
				subtitles={mockSubtitles}
				{selectedQuality}
				{selectedSubtitle}
				onQualityChange={handleQualityChange}
				onSubtitleChange={handleSubtitleChange}
			/>
		</div>

		<div class="rounded-lg bg-muted p-4">
			<h3 class="mb-2 font-semibold">Current State</h3>
			<div class="space-y-2 text-sm">
				<p><strong>Selected Quality:</strong> {selectedQuality}</p>
				<p><strong>Selected Subtitle:</strong> {selectedSubtitle || 'None'}</p>
			</div>
		</div>
	</div>
</div>
