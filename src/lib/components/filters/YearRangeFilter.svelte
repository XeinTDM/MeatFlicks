<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { X } from '@lucide/svelte';

	interface Props {
		yearFrom?: number;
		yearTo?: number;
		onYearFromChange: (year: number | undefined) => void;
		onYearToChange: (year: number | undefined) => void;
	}

	let { yearFrom, yearTo, onYearFromChange, onYearToChange }: Props = $props();

	const currentYear = new Date().getFullYear();
	const minYear = 1900;

	let fromValue = $state(yearFrom?.toString() || '');
	let toValue = $state(yearTo?.toString() || '');

	$effect(() => {
		fromValue = yearFrom?.toString() || '';
	});

	$effect(() => {
		toValue = yearTo?.toString() || '';
	});

	function handleFromChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const value = input.value;
		fromValue = value;

		if (value === '') {
			onYearFromChange(undefined);
		} else {
			const year = parseInt(value, 10);
			if (!isNaN(year) && year >= minYear && year <= currentYear) {
				onYearFromChange(year);
			}
		}
	}

	function handleToChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const value = input.value;
		toValue = value;

		if (value === '') {
			onYearToChange(undefined);
		} else {
			const year = parseInt(value, 10);
			if (!isNaN(year) && year >= minYear && year <= currentYear) {
				onYearToChange(year);
			}
		}
	}

	function clearFrom() {
		fromValue = '';
		onYearFromChange(undefined);
	}

	function clearTo() {
		toValue = '';
		onYearToChange(undefined);
	}
</script>

<div class="space-y-3">
	<div class="grid grid-cols-2 gap-3">
		<!-- From Year -->
		<div class="space-y-2">
			<Label for="year-from" class="text-xs text-muted-foreground">From</Label>
			<div class="relative">
				<Input
					id="year-from"
					type="number"
					min={minYear}
					max={currentYear}
					placeholder={minYear.toString()}
					value={fromValue}
					oninput={handleFromChange}
					class="pr-8"
				/>
				{#if fromValue}
					<Button
						variant="ghost"
						size="icon"
						onclick={clearFrom}
						class="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
						aria-label="Clear from year"
					>
						<X class="h-3 w-3" />
					</Button>
				{/if}
			</div>
		</div>

		<!-- To Year -->
		<div class="space-y-2">
			<Label for="year-to" class="text-xs text-muted-foreground">To</Label>
			<div class="relative">
				<Input
					id="year-to"
					type="number"
					min={minYear}
					max={currentYear}
					placeholder={currentYear.toString()}
					value={toValue}
					oninput={handleToChange}
					class="pr-8"
				/>
				{#if toValue}
					<Button
						variant="ghost"
						size="icon"
						onclick={clearTo}
						class="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
						aria-label="Clear to year"
					>
						<X class="h-3 w-3" />
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Quick presets -->
	<div class="flex flex-wrap gap-2">
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				onYearFromChange(currentYear - 1);
				onYearToChange(currentYear);
			}}
			class="h-7 text-xs"
		>
			Last year
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				onYearFromChange(currentYear - 5);
				onYearToChange(currentYear);
			}}
			class="h-7 text-xs"
		>
			Last 5 years
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				onYearFromChange(2020);
				onYearToChange(currentYear);
			}}
			class="h-7 text-xs"
		>
			2020s
		</Button>
	</div>
</div>
