<script lang="ts">
	import type { PlayerService } from '$lib/components/player/playerService.svelte';
	import type { StreamingService } from '$lib/streaming/streamingService.svelte';
	import type { MediaType } from '$lib/streaming/streamingService.svelte';
	import PlayerControls from '$lib/components/player/PlayerControls.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { PictureInPicture, MonitorPlay } from '@lucide/svelte';

	let {
		playerService,
		streamingService,
		mediaType,
		movieTitle,
		durationMinutes,
		onNextEpisode,
		onOpenInNewTab
	} = $props<{
		playerService: PlayerService;
		streamingService: StreamingService;
		mediaType: MediaType;
		movieTitle: string;
		durationMinutes?: number | null;
		onNextEpisode: () => void;
		onOpenInNewTab: () => void;
	}>();

	const playbackUrl = $derived(
		streamingService.state.source?.embedUrl ?? streamingService.state.source?.streamUrl ?? null
	);
	const displayPlayer = $derived(Boolean(playbackUrl));
	const primarySource = $derived(streamingService.state.source);
	const currentQualities = $derived(streamingService.state.qualities);
	const currentSubtitles = $derived(streamingService.state.subtitles);
</script>

{#if displayPlayer}
	<div
		class={playerService.isTheaterMode
			? 'fixed inset-0 z-50 flex h-screen w-screen bg-black'
			: 'relative mb-8 aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl'}
	>
		{#if playerService.isTheaterMode}
			<button
				class="absolute top-6 right-6 z-50 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
				onclick={playerService.toggleTheaterMode}
				aria-label="Exit Theater Mode"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path
						d="M3 16h3a2 2 0 0 1 2 2v3"
					/><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg
				>
			</button>
		{/if}

		{#if currentQualities.length > 1 || currentSubtitles.length > 0}
			<PlayerControls
				qualities={currentQualities}
				subtitles={currentSubtitles}
				selectedQuality={playerService.selectedQuality}
				selectedSubtitle={playerService.selectedSubtitle ?? undefined}
				onQualityChange={(quality) => playerService.handleQualityChange(quality, currentQualities)}
				onSubtitleChange={(subtitle) => playerService.handleSubtitleChange(subtitle)}
				compact={true}
			/>
		{/if}

		{#if primarySource?.embedUrl}
			<iframe
				bind:this={playerService.iframeElement}
				src={playbackUrl}
				title="Player"
				class="h-full w-full border-none"
				allowfullscreen
				allow="autoplay; fullscreen; picture-in-picture"
				onload={() => playerService.handleIframeLoad(currentQualities, currentSubtitles)}
			></iframe>
		{:else}
			<div class="flex h-full w-full items-center justify-center text-white">
				<p>Stream not available for this provider.</p>
			</div>
		{/if}

		{#if playerService.showNextOverlay && mediaType === 'tv'}
			<div
				class="overlay-enter absolute right-6 bottom-6 z-40 w-80 overflow-hidden rounded-xl border border-white/10 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-md"
			>
				<div class="mb-4">
					<h4 class="text-xs font-semibold tracking-wider text-white/60 uppercase">Up Next</h4>
					<p class="mt-1 text-lg font-bold">{movieTitle}</p>
				</div>

				<div class="flex items-center gap-3">
					<Button
						size="sm"
						class="w-full bg-white text-black hover:bg-gray-200"
						onclick={onNextEpisode}
					>
						Play Now
					</Button>
					<Button
						size="sm"
						variant="outline"
						class="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
						onclick={playerService.cancelAutoPlay}
					>
						Cancel
					</Button>
				</div>

				{#if playerService.isAutoPlay}
					<div class="absolute bottom-0 left-0 h-1 w-full bg-white/10">
						<div class="animate-progress h-full origin-left bg-primary"></div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<div
		class="relative mb-8 flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-gray-900/50 shadow-2xl"
	>
		<div class="p-4 text-center">
			<p class="text-sm text-muted-foreground">
				{#if streamingService.state.isResolving}
					Loading player...
				{:else if !streamingService.currentProviderId}
					Select a streaming provider to begin playback
				{:else}
					No playback source available. Try selecting a different provider.
				{/if}
			</p>
			{#if streamingService.state.error && !streamingService.state.isResolving}
				<p class="mt-2 text-sm text-destructive">{streamingService.state.error}</p>
			{/if}
		</div>
	</div>
{/if}

{#if !playerService.isTheaterMode}
	<div class="mb-6 flex flex-wrap items-center justify-between gap-6 text-sm text-muted-foreground">
		<div class="flex flex-wrap items-center gap-6">
			{#if playbackUrl}
				<Button variant="secondary" size="sm" onclick={onOpenInNewTab}>Open in New Tab</Button>
			{/if}
			{#if mediaType === 'tv'}
				<label
					class="flex cursor-pointer items-center gap-2 transition-colors hover:text-foreground"
				>
					<Checkbox
						bind:checked={playerService.isAutoPlay}
						class="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary"
					/>
					<span>Auto-play Next</span>
				</label>
			{/if}
			<button
				onclick={playerService.togglePictureInPicture}
				class="flex items-center gap-2 transition-colors hover:text-foreground"
				disabled={typeof document === 'undefined' || !('pictureInPictureEnabled' in document)}
			>
				<PictureInPicture class="h-4 w-4" />
				Picture-in-Picture
			</button>
			<Button
				variant="ghost"
				size="sm"
				onclick={playerService.toggleTheaterMode}
				class="flex items-center gap-2 transition-colors hover:text-foreground"
			>
				<MonitorPlay class="h-4 w-4" />
				Theater Mode
			</Button>
		</div>
	</div>
{/if}

<style>
	@keyframes progress {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
	.animate-progress {
		animation: progress 30s linear forwards;
	}
	.overlay-enter {
		animation: slideUp 0.5s ease-out forwards;
	}
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
