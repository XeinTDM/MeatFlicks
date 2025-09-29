<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	type $$Props = { value: string; class?: string } & Record<string, unknown>;
	type TriggerProps = $$Props;

	let { value, class: className = undefined, ...restProps } = $props();
	const forwardedProps = restProps as Omit<TriggerProps, 'value' | 'class'>;
</script>

<TabsPrimitive.Trigger
	data-slot="tabs-trigger"
	{value}
	class={cn(
		'inline-flex min-w-[100px] items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground',
		className
	)}
	{...forwardedProps}
/>
