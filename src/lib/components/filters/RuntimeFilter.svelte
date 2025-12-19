<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Clock } from '@lucide/svelte';
	import { RUNTIME_PRESETS, type RuntimePreset } from '$lib/types/filters';

	interface Props {
		runtimeMin?: number;
		runtimeMax?: number;
		onRuntimeMinChange: (runtime: number | undefined) => void;
		onRuntimeMaxChange: (runtime: number | undefined) => void;
	}

	let { runtimeMin, runtimeMax, onRuntimeMinChange, onRuntimeMaxChange }: Props = $props();

	let selectedPreset = $state<RuntimePreset | null>(null);

	function selectPreset(preset: RuntimePreset) {
		const { min, max } = RUNTIME_PRESETS[preset];
		selectedPreset = preset;
		onRuntimeMinChange(min > 0 ? min : undefined);
		onRuntimeMaxChange(max < 999 ? max : undefined);
	}

	function clearRuntime() {
		selectedPreset = null;
		onRuntimeMinChange(undefined);
		onRuntimeMaxChange(undefined);
	}

	function formatDuration(minutes: number | undefined): string {
		if (!minutes) return '';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	let currentRange = $derived(() => {
		if (!runtimeMin && !runtimeMax) return null;
		if (runtimeMin && runtimeMax) {
			return `${formatDuration(runtimeMin)} - ${formatDuration(runtimeMax)}`;
		}
		if (runtimeMin) return `${formatDuration(runtimeMin)}+`;
		if (runtimeMax) return `Up to ${formatDuration(runtimeMax)}`;
		return null;
	});
</script>

<div class="space-y-3">
	<!-- Current selection -->
	{#if currentRange()}
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Clock class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm font-medium">{currentRange()}</span>
			</div>
			<Button variant="ghost" size="sm" onclick={clearRuntime} class="h-7 text-xs">Clear</Button>
		</div>
	{/if}

	<!-- Preset buttons -->
	<div class="grid grid-cols-1 gap-2">
		{#each Object.entries(RUNTIME_PRESETS) as [key, preset]}
			<Button
				variant={selectedPreset === key ? 'default' : 'outline'}
				size="sm"
				onclick={() => selectPreset(key as RuntimePreset)}
				class="justify-start text-left"
			>
				<Clock class="mr-2 h-4 w-4" />
				{preset.label}
			</Button>
		{/each}
	</div>
</div>
