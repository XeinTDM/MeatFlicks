<script lang="ts">
	import MediaDetailsPage from '$lib/components/media/MediaDetailsPage.svelte';
	import type { PageData } from './$types';

	const props = $props<{ data: PageData }>();
</script>

<MediaDetailsPage data={props.data} />
