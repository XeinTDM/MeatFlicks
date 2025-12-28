<script lang="ts">
	import MediaDetailsPage from '$lib/components/media/MediaDetailsPage.svelte';
	import type { PageData } from './$types';

	// Access props directly to maintain reactivity in Svelte 5
	const props = $props<{ data: PageData }>();

	// Debug the data received on the client side
	console.log('[DEBUG] Movie page client received data:', {
		hasMovie: Boolean(props.data.movie),
		movieTitle: props.data.movie?.title,
		hasStreaming: Boolean(props.data.streaming),
		streamingSource: props.data.streaming?.source,
		streamingResolutions: props.data.streaming?.resolutions,
		resolutionCount: props.data.streaming?.resolutions?.length || 0
	});
</script>

<MediaDetailsPage data={props.data} />
