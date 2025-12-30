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
				<div class="h-96 bg-muted rounded-lg mb-8"></div>
				<div class="space-y-4">
					<div class="h-8 bg-muted rounded w-1/3"></div>
					<div class="h-4 bg-muted rounded w-2/3"></div>
					<div class="h-4 bg-muted rounded w-1/2"></div>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
						{#each Array(8) as _}
							<div class="h-48 bg-muted rounded"></div>
						{/each}
					</div>
				</div>
			</div>
		</main>
	</div>
{/if}
