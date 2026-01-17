<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw, AlertCircle, Check } from '@lucide/svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { ProviderResolution } from '$lib/streaming/provider-registry';

	let {
		resolutions,
		selectedProvider,
		isResolving,
		isReporting = false,
		hasRequestedPlayback,
		onProviderSelect,
		onPlayClick,
		onReportBroken
	} = $props<{
		resolutions: ProviderResolution[];
		selectedProvider: string | null;
		isResolving: boolean;
		isReporting?: boolean;
		hasRequestedPlayback: boolean;
		onProviderSelect: (providerId: string) => void;
		onPlayClick: () => void;
		onReportBroken?: () => void;
	}>();

	let showReportSuccess = $state(false);

	const selectedProviderLabel = $derived.by(() => {
		const res = resolutions.find((r: ProviderResolution) => r.providerId === selectedProvider);
		if (!res) return 'Select Provider';
		return res.success ? res.label : `${res.label} (Unavailable)`;
	});

	async function handleReport() {
		if (onReportBroken) {
			onReportBroken();
			showReportSuccess = true;
			setTimeout(() => {
				showReportSuccess = false;
			}, 3000);
		}
	}
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
		<div class="ml-auto flex items-center gap-1">
			<Button
				variant="outline"
				size="icon"
				onclick={onPlayClick}
				disabled={isResolving}
				title="Reload Player"
			>
				<RefreshCw class="h-5 w-5" />
			</Button>

			{#if onReportBroken}
				<Button
					variant="outline"
					size="icon"
					onclick={handleReport}
					disabled={isReporting || showReportSuccess}
					class="text-muted-foreground hover:text-destructive"
					title="Report provider as broken"
				>
					{#if showReportSuccess}
						<Check class="h-5 w-5 text-green-500" />
					{:else}
						<AlertCircle class="h-5 w-5" />
					{/if}
				</Button>
			{/if}
		</div>
	{/if}
</div>
