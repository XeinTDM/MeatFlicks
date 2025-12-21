<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const toggleGroupVariants = tv({
		base: 'inline-flex items-center justify-center gap-1 rounded-md bg-muted p-1 text-muted-foreground'
	});

	export const toggleGroupItemVariants = tv({
		base: 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		variants: {
			variant: {
				default: 'bg-transparent hover:bg-background hover:text-foreground',
				active: 'bg-background text-foreground shadow-sm'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>;
	export type ToggleGroupItemVariants = VariantProps<typeof toggleGroupItemVariants>;
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import { setContext, getContext } from 'svelte';

	interface Props {
		type?: 'single' | 'multiple';
		value?: string | string[];
		onValueChange?: (value: string | string[]) => void;
		disabled?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let {
		type = 'single',
		value = $bindable(type === 'single' ? '' : []),
		onValueChange,
		disabled = false,
		class: className,
		children
	}: Props = $props();

	const styles = toggleGroupVariants();

	function toggleValue(itemValue: string) {
		if (disabled) return;

		if (type === 'single') {
			const newValue = value === itemValue ? '' : itemValue;
			value = newValue;
			onValueChange?.(newValue);
		} else {
			const currentValues = Array.isArray(value) ? value : [];
			const newValues = currentValues.includes(itemValue)
				? currentValues.filter((v) => v !== itemValue)
				: [...currentValues, itemValue];
			value = newValues;
			onValueChange?.(newValues);
		}
	}

	function isActive(itemValue: string): boolean {
		if (type === 'single') {
			return value === itemValue;
		}
		return Array.isArray(value) && value.includes(itemValue);
	}

	setContext('toggleGroup', {
		toggleValue,
		isActive,
		disabled
	});
</script>

<div class={cn(styles, className)} role="group">
	{@render children?.()}
</div>
