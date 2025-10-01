<script lang="ts">
	import MediaDetailsPage from '$lib/components/MediaDetailsPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<MediaDetailsPage {data} />
