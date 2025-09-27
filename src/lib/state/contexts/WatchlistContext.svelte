<script lang="ts">
  import { setContext } from 'svelte';
  import { watchlist } from '../stores/watchlistStore';

  setContext('watchlist', watchlist);
</script>

<slot />
