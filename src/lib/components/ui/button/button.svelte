<script lang="ts" module>
	export {
		buttonVariants,
		type ButtonProps,
		type ButtonSize,
		type ButtonVariant
	} from './button.config';
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from './button.config';
	import type { ButtonProps } from './button.config';

interface $$Events {
	click: MouseEvent;
}

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		data-sveltekit-preload-data="hover"
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
