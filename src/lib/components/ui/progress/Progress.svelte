<script lang="ts">
	import { cva, type VariantProps } from 'class-variance-authority';
	import { cn } from '$lib/utils';

	const progressVariants = cva(
		'flex h-4 w-full items-center justify-center overflow-hidden rounded-full bg-secondary',
		{
			variants: {
				variant: {
					default: '',
					primary: 'bg-primary'
				},
				size: {
					default: 'h-2',
					sm: 'h-1',
					lg: 'h-3'
				}
			},
			defaultVariants: {
				variant: 'default',
				size: 'default'
			}
		}
	);

	interface Props extends VariantProps<typeof progressVariants> {
		value?: number;
		max?: number;
		class?: string;
	}

	let { value = 0, max = 100, class: className, variant, size }: Props = $props();

	let percentage = $derived(Math.min(Math.max((value / max) * 100, 0), 100));
</script>

<div
	class={cn(progressVariants({ variant, size, className }))}
	role="progressbar"
	aria-valuenow={value}
	aria-valuemax={max}
	aria-valuemin={0}
>
	<div
		class="h-full w-full flex-1 bg-background transition-all duration-300 ease-in-out"
		style="transform: translateX(-{100 - percentage}%)"
	>
		<div
			class={cn('h-full rounded-full', variant === 'primary' ? 'bg-primary' : 'bg-primary')}
			style="width: {percentage}%"
		></div>
	</div>
</div>
