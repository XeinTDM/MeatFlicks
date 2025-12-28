<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw } from '@lucide/svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';

	let {
		resolutions,
		selectedProvider,
		isResolving,
		hasRequestedPlayback,
		onProviderSelect,
		onPlayClick
	} = $props<{
		resolutions: ProviderResolution[];
		selectedProvider: string | null;
		isResolving: boolean;
		hasRequestedPlayback: boolean;
		onProviderSelect: (providerId: string) => void;
		onPlayClick: () => void;
	}>();

	const selectedProviderLabel = $derived.by(() => {
		const res = resolutions.find((r: ProviderResolution) => r.providerId === selectedProvider);
		if (!res) return 'Select Provider';
		return res.success ? res.label : `${res.label} (Unavailable)`;
	});
</script>

<div class="flex items-center gap-2">
	<Select
		type="single"
		value={selectedProvider || ''}
		onValueChange={(value) => value && onProviderSelect(value)}
		disabled={isResolving}
	>
		<SelectTrigger class="w-[200px] cursor-pointer" aria-label="Select provider">
			<span class="flex items-center gap-2" data-slot="select-value">
				{selectedProviderLabel}
			</span>
		</SelectTrigger>
		<SelectContent>
			{#each resolutions as resolution (resolution.providerId)}
				<SelectItem value={resolution.providerId} disabled={!resolution.success}>
					<div class="flex w-full items-center justify-between gap-2">
						<span>{resolution.label}</span>
						{#if !resolution.success}
							<span class="text-xs text-muted-foreground opacity-70">(Unavailable)</span>
						{/if}
					</div>
				</SelectItem>
			{/each}
		</SelectContent>
	</Select>

	{#if hasRequestedPlayback}
		<Button
			variant="outline"
			size="icon"
			onclick={onPlayClick}
			disabled={isResolving}
			class="ml-auto"
			title="Reload Player"
		>
			<RefreshCw class="h-5 w-5" />
		</Button>
	{/if}
</div>
