<script lang="ts">
	import { setContext } from 'svelte';
	import { watchlist } from '../stores/watchlistStore.svelte';

	setContext('watchlist', watchlist);
</script>

<slot />
