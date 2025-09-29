<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let { class: className, ...restProps } = $props();
</script>

<TabsPrimitive.Root data-slot="tabs" class={cn('w-full', className)} {...restProps} />
