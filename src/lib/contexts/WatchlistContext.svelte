<script lang="ts">
  import { setContext } from 'svelte';
  import { watchlist } from './watchlistStore';

  setContext('watchlist', watchlist);
</script>

<slot />
