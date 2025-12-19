<script lang="ts" context="module">
	import { type VariantProps, tv } from 'tailwind-variants';

	export const sliderVariants = tv({
		slots: {
			root: 'relative flex w-full touch-none select-none items-center',
			track: 'relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary',
			range: 'absolute h-full bg-primary',
			thumb:
				'block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
		}
	});

	export type SliderVariants = VariantProps<typeof sliderVariants>;
</script>

<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value?: number[];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		onValueChange?: (value: number[]) => void;
		class?: string;
	}

	let {
		value = $bindable([0]),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		onValueChange,
		class: className
	}: Props = $props();

	const styles = sliderVariants();

	let trackRef: HTMLDivElement;
	let isDragging = $state(false);
	let activeThumbIndex = $state<number | null>(null);

	function getPercentage(val: number): number {
		return ((val - min) / (max - min)) * 100;
	}

	function getValueFromPosition(clientX: number): number {
		if (!trackRef) return min;

		const rect = trackRef.getBoundingClientRect();
		const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const rawValue = min + percent * (max - min);
		const steppedValue = Math.round(rawValue / step) * step;
		return Math.max(min, Math.min(max, steppedValue));
	}

	function handlePointerDown(event: PointerEvent, index: number) {
		if (disabled) return;

		event.preventDefault();
		isDragging = true;
		activeThumbIndex = index;

		const target = event.target as HTMLElement;
		target.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!isDragging || activeThumbIndex === null || disabled) return;

		const newValue = getValueFromPosition(event.clientX);
		const newValues = [...value];
		newValues[activeThumbIndex] = newValue;

		// Ensure thumbs don't cross
		if (newValues.length === 2) {
			if (activeThumbIndex === 0 && newValue > newValues[1]) {
				newValues[0] = newValues[1];
			} else if (activeThumbIndex === 1 && newValue < newValues[0]) {
				newValues[1] = newValues[0];
			}
		}

		value = newValues;
		onValueChange?.(newValues);
	}

	function handlePointerUp(event: PointerEvent) {
		if (!isDragging) return;

		isDragging = false;
		activeThumbIndex = null;

		const target = event.target as HTMLElement;
		target.releasePointerCapture(event.pointerId);
	}

	function handleTrackClick(event: MouseEvent) {
		if (disabled || isDragging) return;

		const newValue = getValueFromPosition(event.clientX);

		// Find closest thumb
		if (value.length === 1) {
			value = [newValue];
			onValueChange?.([newValue]);
		} else if (value.length === 2) {
			const distToFirst = Math.abs(newValue - value[0]);
			const distToSecond = Math.abs(newValue - value[1]);
			const index = distToFirst < distToSecond ? 0 : 1;

			const newValues = [...value];
			newValues[index] = newValue;

			// Ensure order
			newValues.sort((a, b) => a - b);

			value = newValues;
			onValueChange?.(newValues);
		}
	}

	let rangeStart = $derived(value.length === 2 ? getPercentage(Math.min(...value)) : 0);
	let rangeWidth = $derived(
		value.length === 2
			? getPercentage(Math.max(...value)) - getPercentage(Math.min(...value))
			: getPercentage(value[0] || 0)
	);
</script>

<div class={cn(styles.root(), className)} data-disabled={disabled ? '' : undefined}>
	<div bind:this={trackRef} class={styles.track()} onclick={handleTrackClick} role="presentation">
		<div
			class={styles.range()}
			style="left: {rangeStart}%; width: {rangeWidth}%"
			role="presentation"
		></div>
	</div>

	{#each value as val, index}
		<button
			type="button"
			role="slider"
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={val}
			aria-disabled={disabled}
			class={styles.thumb()}
			style="left: {getPercentage(val)}%"
			onpointerdown={(e) => handlePointerDown(e, index)}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			{disabled}
		></button>
	{/each}
</div>
