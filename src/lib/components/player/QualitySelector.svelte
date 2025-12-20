<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { VideoQuality } from '$lib/streaming/types';
	import { Monitor } from '@lucide/svelte';

	interface Props {
		qualities: VideoQuality[];
		selectedQuality?: string;
		onQualityChange?: (quality: VideoQuality) => void;
		disabled?: boolean;
	}

	let {
		qualities = [],
		selectedQuality,
		onQualityChange,
		disabled = false
	}: Props = $props();

	let selectedQualityValue = $state(selectedQuality || qualities.find(q => q.isDefault)?.label || qualities[0]?.label || 'auto');

	function handleQualityChange(value: string) {
		selectedQualityValue = value;
		const quality = qualities.find(q => q.label === value || q.resolution === value);
		if (quality && onQualityChange) {
			onQualityChange(quality);
		}
	}

	// Sort qualities by resolution (highest first)
	const sortedQualities = $derived(
		[...qualities].sort((a, b) => {
			const getResolutionValue = (resolution: string) => {
				if (resolution.includes('4K')) return 4000;
				if (resolution.includes('1080')) return 1080;
				if (resolution.includes('720')) return 720;
				if (resolution.includes('480')) return 480;
				if (resolution.includes('360')) return 360;
				return 0;
			};
			return getResolutionValue(b.resolution) - getResolutionValue(a.resolution);
		})
	);

	// Get display name for quality
	const getQualityDisplayName = (quality: VideoQuality) => {
		if (quality.label === 'Auto') return 'Auto';
		if (quality.resolution.includes('4K')) return '4K Ultra HD';
		if (quality.resolution.includes('1080')) return '1080p Full HD';
		if (quality.resolution.includes('720')) return '720p HD';
		if (quality.resolution.includes('480')) return '480p SD';
		if (quality.resolution.includes('360')) return '360p';
		return quality.label;
	};

	// Get current selected quality object
	const currentQuality = $derived(
		qualities.find(q => 
			q.label === selectedQualityValue || 
			q.resolution === selectedQualityValue ||
			(q.isDefault && selectedQualityValue === 'auto')
		) || qualities.find(q => q.isDefault) || qualities[0]
	);
</script>

{#if qualities.length > 1}
	<div class="relative">
	<Select bind:value={selectedQualityValue} type="single" {disabled}>
		<SelectTrigger class="w-32 bg-black/80 text-white border-white/20 hover:bg-black/90">
			<div class="flex items-center gap-2">
				<Monitor class="h-4 w-4" />
				<span>{getQualityDisplayName(currentQuality)}</span>
			</div>
		</SelectTrigger>
		<SelectContent class="bg-black/95 border-white/20">
			{#each sortedQualities as quality}
				<SelectItem value={quality.label} class="text-white hover:bg-white/10 focus:bg-white/10">
					<div class="flex items-center justify-between w-full">
						<span>{getQualityDisplayName(quality)}</span>
						{#if quality.isDefault}
							<span class="text-xs text-primary ml-2">Default</span>
						{/if}
					</div>
				</SelectItem>
			{/each}
		</SelectContent>
	</Select>
	</div>
{:else if qualities.length === 1}
	<div class="flex items-center gap-2 text-sm text-white/80 bg-black/60 px-3 py-1 rounded">
		<Monitor class="h-4 w-4" />
		<span>{getQualityDisplayName(qualities[0])}</span>
	</div>
{/if}
