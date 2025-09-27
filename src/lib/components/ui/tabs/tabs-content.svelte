<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils';

  let { class: className, ...restProps } = $props();
</script>

<TabsPrimitive.Content
  data-slot="tabs-content"
  class={cn('mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
  {...restProps}
/>
