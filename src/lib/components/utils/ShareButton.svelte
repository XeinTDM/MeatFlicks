<script lang="ts">
	import { Share2, Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	let { url, title, description }: { url: string; title: string; description?: string } = $props();

	let isCopied = $state(false);
	let canShare = $state(false);

	onMount(() => {
		canShare = typeof navigator !== 'undefined' && 'share' in navigator;
	});

	async function handleShare() {
		if (canShare && navigator.share) {
			try {
				await navigator.share({
					title,
					text: description || title,
					url
				});
			} catch (error) {
				if ((error as Error).name !== 'AbortError') {
					console.error('Error sharing:', error);
				}
			}
		} else {
			await copyToClipboard();
		}
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(url);
			isCopied = true;
			setTimeout(() => {
				isCopied = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
		}
	}
</script>

<Button
	variant="outline"
	size="icon"
	onclick={handleShare}
	class="gap-2"
	aria-label="Share {title}"
>
	{#if isCopied}
		<Check class="h-4 w-4" />
		<span class="sr-only">Copied!</span>
	{:else}
		<Share2 class="h-4 w-4" />
		<span class="sr-only">Share</span>
	{/if}
</Button>
