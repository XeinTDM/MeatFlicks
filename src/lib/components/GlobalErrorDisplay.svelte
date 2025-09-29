<script lang="ts">
	import { onMount } from 'svelte';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	const errorStore = getContext<Writable<string | null>>('error');
	let isVisible = $state(false);
	let timeoutId: ReturnType<typeof setTimeout>;

	$effect(() => {
		const error = $errorStore;
		if (error) {
			isVisible = true;
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				isVisible = false;
				$errorStore = null;
			}, 5000);
		}
	});

	onMount(() => {
		return () => clearTimeout(timeoutId);
	});
</script>

{#if isVisible}
	<div
		class={`fixed right-4 bottom-4 z-[999] rounded-md bg-red-600 px-4 py-3 text-white shadow-lg transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
	>
		<p class="font-medium">Error: {$errorStore}</p>
	</div>
{/if}
