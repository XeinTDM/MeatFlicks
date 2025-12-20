<script lang="ts">
	import QualitySelector from './QualitySelector.svelte';
	import SubtitleSelector from './SubtitleSelector.svelte';
	import type { VideoQuality, SubtitleTrack } from '$lib/streaming/types';
	import { Settings } from '@lucide/svelte';

	interface Props {
		qualities?: VideoQuality[];
		subtitles?: SubtitleTrack[];
		selectedQuality?: string;
		selectedSubtitle?: string | undefined;
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

	const hasControls = $derived(qualities.length > 1 || subtitles.length > 0);
</script>

{#if hasControls}
	<div class="relative">
		{#if compact}
			<button
				class="flex items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-white transition-colors hover:bg-black/90"
				onclick={() => (showSettings = !showSettings)}
				title="Player Settings"
			>
				<Settings class="h-4 w-4" />
				<span class="text-sm">Settings</span>
			</button>

			{#if showSettings}
				<div
					class="absolute right-0 bottom-full z-50 mb-2 min-w-48 rounded-lg border border-white/20 bg-black/95 p-4 shadow-xl"
				>
					<div class="space-y-4">
						{#if qualities.length > 1}
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-white">Quality</span>
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
								<span class="text-sm font-medium text-white">Subtitles</span>
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
	<div class="flex items-center gap-2 rounded bg-black/40 px-3 py-1 text-sm text-white/60">
		<Settings class="h-4 w-4" />
		<span>No controls</span>
	</div>
{/if}

{#if compact && showSettings}
	<div
		class="fixed inset-0 z-40"
		onclick={() => (showSettings = false)}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' ? (showSettings = false) : null)}
		role="button"
		tabindex="0"
		aria-label="Close settings"
	></div>
{/if}

<style>
	:global(.relative) {
		position: relative;
	}
</style>
