<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let MediaDetailsPage = $state<any>(null);
	let props = $props<{ data: PageData }>();

	onMount(async () => {
		const module = await import('$lib/components/media/MediaDetailsPage.svelte');
		MediaDetailsPage = module.default;
	});
</script>

{#if MediaDetailsPage}
	<MediaDetailsPage data={props.data} />
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<main class="mx-auto max-w-7xl px-4 py-8">
			<div class="animate-pulse">
				<div class="mb-8 h-96 rounded-lg bg-muted"></div>
				<div class="space-y-4">
					<div class="h-8 w-1/3 rounded bg-muted"></div>
					<div class="h-4 w-2/3 rounded bg-muted"></div>
					<div class="h-4 w-1/2 rounded bg-muted"></div>
					<div class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
						{#each Array(8)}
							<div class="h-48 rounded bg-muted"></div>
						{/each}
					</div>
				</div>
			</div>
		</main>
	</div>
{/if}
