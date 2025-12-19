<script lang="ts">
	import { Slider } from '$lib/components/ui/slider';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Star } from '@lucide/svelte';

	interface Props {
		minRating?: number;
		maxRating?: number;
		onMinRatingChange: (rating: number | undefined) => void;
		onMaxRatingChange: (rating: number | undefined) => void;
	}

	let { minRating, maxRating, onMinRatingChange, onMaxRatingChange }: Props = $props();

	let sliderValue = $state([minRating || 0, maxRating || 10]);

	$effect(() => {
		sliderValue = [minRating || 0, maxRating || 10];
	});

	function handleSliderChange(values: number[]) {
		sliderValue = values;
		const [min, max] = values;

		// Only set if different from defaults
		onMinRatingChange(min > 0 ? min : undefined);
		onMaxRatingChange(max < 10 ? max : undefined);
	}

	function setMinimumRating(rating: number) {
		onMinRatingChange(rating);
		if (maxRating && rating > maxRating) {
			onMaxRatingChange(rating);
		}
	}
</script>

<div class="space-y-4">
	<!-- Current range display -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Star class="h-4 w-4 fill-yellow-500 text-yellow-500" />
			<span class="text-sm font-medium">
				{sliderValue[0].toFixed(1)} - {sliderValue[1].toFixed(1)}
			</span>
		</div>
		{#if minRating || (maxRating && maxRating < 10)}
			<Badge variant="secondary" class="text-xs">
				{minRating || 0}+ rating
			</Badge>
		{/if}
	</div>

	<!-- Slider -->
	<Slider
		min={0}
		max={10}
		step={0.5}
		value={sliderValue}
		onValueChange={handleSliderChange}
		class="w-full"
	/>

	<!-- Quick presets -->
	<div class="flex flex-wrap gap-2">
		<button
			onclick={() => setMinimumRating(7)}
			class="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			7+ Highly Rated
		</button>
		<button
			onclick={() => setMinimumRating(8)}
			class="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			8+ Excellent
		</button>
		<button
			onclick={() => setMinimumRating(9)}
			class="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			9+ Masterpiece
		</button>
	</div>
</div>
