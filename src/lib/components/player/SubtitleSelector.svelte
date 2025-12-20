<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { SubtitleTrack } from '$lib/streaming/types';
	import { Subtitles, Plus } from '@lucide/svelte';

	interface Props {
		subtitles: SubtitleTrack[];
		selectedSubtitle?: string;
		onSubtitleChange?: (subtitle: SubtitleTrack | null) => void;
		disabled?: boolean;
	}

	let {
		subtitles = [],
		selectedSubtitle,
		onSubtitleChange,
		disabled = false
	}: Props = $props();

	let selectedSubtitleValue = $state(selectedSubtitle || 'off');

	function handleSubtitleChange(value: string) {
		selectedSubtitleValue = value;
		if (value === 'off') {
			if (onSubtitleChange) {
				onSubtitleChange(null);
			}
		} else {
			const subtitle = subtitles.find(s => s.id === value);
			if (subtitle && onSubtitleChange) {
				onSubtitleChange(subtitle);
			}
		}
	}

	// Sort subtitles: default first, then English, then alphabetically
	const sortedSubtitles = $derived(
		[...subtitles].sort((a, b) => {
			if (a.isDefault && !b.isDefault) return -1;
			if (!a.isDefault && b.isDefault) return 1;
			if (a.language === 'en' && b.language !== 'en') return -1;
			if (a.language !== 'en' && b.language === 'en') return 1;
			return a.label.localeCompare(b.label);
		})
	);

	// Get current selected subtitle object
	const currentSubtitle = $derived(
		selectedSubtitleValue === 'off' ? null : 
		subtitles.find(s => s.id === selectedSubtitleValue) || 
		subtitles.find(s => s.isDefault) || 
		subtitles[0]
	);
</script>

{#if subtitles.length > 0}
	<div class="relative">
		<Select bind:value={selectedSubtitleValue} {disabled}>
			<SelectTrigger class="w-36 bg-black/80 text-white border-white/20 hover:bg-black/90">
				<div class="flex items-center gap-2">
					<Subtitles class="h-4 w-4" />
					<span class="truncate">
						{currentSubtitle ? currentSubtitle.label : 'Off'}
					</span>
				</div>
			</SelectTrigger>
			<SelectContent class="bg-black/95 border-white/20">
				<!-- Off option -->
				<SelectItem value="off" class="text-white hover:bg-white/10 focus:bg-white/10">
					<div class="flex items-center gap-2">
						<Plus class="h-3 w-3 rotate-45 opacity-60" />
						<span>Off</span>
					</div>
				</SelectItem>
				
				{#each sortedSubtitles as subtitle}
					<SelectItem value={subtitle.id} class="text-white hover:bg-white/10 focus:bg-white/10">
						<div class="flex items-center justify-between w-full">
							<span>{subtitle.label}</span>
							<div class="flex items-center gap-2">
								{#if subtitle.language}
									<span class="text-xs text-white/60 uppercase">{subtitle.language}</span>
								{/if}
								{#if subtitle.isDefault}
									<span class="text-xs text-primary">Default</span>
								{/if}
							</div>
						</div>
					</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>
{:else}
	<div class="flex items-center gap-2 text-sm text-white/60 bg-black/40 px-3 py-1 rounded">
		<Subtitles class="h-4 w-4" />
		<span>No subtitles</span>
	</div>
{/if}
