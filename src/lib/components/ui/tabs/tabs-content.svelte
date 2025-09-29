<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	type $$Props = { value: string; class?: string } & Record<string, unknown>;
	type ContentProps = $$Props;

	let { value, class: className = undefined, ...restProps } = $props();
	const forwardedProps = restProps as Omit<ContentProps, 'value' | 'class'>;
</script>

<TabsPrimitive.Content
	data-slot="tabs-content"
	{value}
	class={cn(
		'mt-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
		className
	)}
	{...forwardedProps}
/>
