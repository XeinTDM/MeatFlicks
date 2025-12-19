<script lang="ts">
	import { cn } from '$lib/utils';
	import { getContext } from 'svelte';
	import { toggleGroupItemVariants } from './ToggleGroup.svelte';

	interface Props {
		value: string;
		disabled?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { value, disabled = false, class: className, children }: Props = $props();

	const context = getContext<{
		toggleValue: (value: string) => void;
		isActive: (value: string) => boolean;
		disabled: boolean;
	}>('toggleGroup');

	const isDisabled = $derived(disabled || context?.disabled);
	const isActive = $derived(context?.isActive(value) || false);

	const styles = toggleGroupItemVariants();

	function handleClick() {
		if (!isDisabled) {
			context?.toggleValue(value);
		}
	}
</script>

<button
	type="button"
	class={cn(styles({ variant: isActive ? 'active' : 'default' }), className)}
	onclick={handleClick}
	disabled={isDisabled}
	aria-pressed={isActive}
	data-state={isActive ? 'on' : 'off'}
>
	{@render children?.()}
</button>
