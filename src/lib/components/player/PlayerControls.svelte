<script lang="ts">
	import QualitySelector from './QualitySelector.svelte';
	import SubtitleSelector from './SubtitleSelector.svelte';
	import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';
	import { Settings } from '@lucide/svelte';

	interface Props {
		qualities?: VideoQuality[];
		subtitles?: SubtitleTrack[];
		selectedQuality?: string;
		selectedSubtitle?: string;
		onQualityChange?: (quality: VideoQuality) => void;
		onSubtitleChange?: (subtitle: SubtitleTrack | null) => void;
		disabled?: boolean;
		compact?: boolean;
	}

	let {
		qualities = [],
		subtitles = [],
		selectedQuality,
		selectedSubtitle,
		onQualityChange,
		onSubtitleChange,
		disabled = false,
		compact = false
	}: Props = $props();

	let showSettings = $state(false);

	function handleQualityChange(quality: VideoQuality) {
		if (onQualityChange) {
			onQualityChange(quality);
		}
	}

	function handleSubtitleChange(subtitle: SubtitleTrack | null) {
		if (onSubtitleChange) {
			onSubtitleChange(subtitle);
		}
	}

	// Only show settings panel if we have qualities or subtitles
	const hasControls = $derived(qualities.length > 1 || subtitles.length > 0);
</script>

{#if hasControls}
	<div class="relative">
		{#if compact}
			<!-- Compact mode: Show settings button -->
			<button
				class="flex items-center gap-2 bg-black/80 text-white px-3 py-2 rounded-lg border border-white/20 hover:bg-black/90 transition-colors"
				onclick={() => showSettings = !showSettings}
				title="Player Settings"
			>
				<Settings class="h-4 w-4" />
				<span class="text-sm">Settings</span>
			</button>

			{#if showSettings}
				<div class="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/20 rounded-lg p-4 shadow-xl z-50 min-w-48">
					<div class="space-y-4">
						{#if qualities.length > 1}
							<div class="flex items-center justify-between">
								<span class="text-white text-sm font-medium">Quality</span>
								<QualitySelector
									{qualities}
									{selectedQuality}
									onQualityChange={handleQualityChange}
									{disabled}
								/>
							</div>
						{/if}

						{#if subtitles.length > 0}
							<div class="flex items-center justify-between">
								<span class="text-white text-sm font-medium">Subtitles</span>
								<SubtitleSelector
									{subtitles}
									{selectedSubtitle}
									onSubtitleChange={handleSubtitleChange}
									{disabled}
								/>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<!-- Full mode: Show controls directly -->
			<div class="flex items-center gap-3">
				{#if qualities.length > 1}
					<QualitySelector
						{qualities}
						{selectedQuality}
						onQualityChange={handleQualityChange}
						{disabled}
					/>
				{/if}

				{#if subtitles.length > 0}
					<SubtitleSelector
						{subtitles}
						{selectedSubtitle}
						onSubtitleChange={handleSubtitleChange}
						{disabled}
					/>
				{/if}
			</div>
		{/if}
	</div>
{:else if !disabled}
	<!-- No controls available -->
	<div class="flex items-center gap-2 text-sm text-white/60 bg-black/40 px-3 py-1 rounded">
		<Settings class="h-4 w-4" />
		<span>No controls</span>
	</div>
{/if}

<!-- Click outside to close settings panel -->
{#if compact && showSettings}
	<div
		class="fixed inset-0 z-40"
		onclick={() => showSettings = false}
		role="button"
		tabindex="-1"
		aria-label="Close settings"
	></div>
{/if}

<style>
	/* Ensure settings panel appears above other content */
	:global(.relative) {
		position: relative;
	}
</style>
