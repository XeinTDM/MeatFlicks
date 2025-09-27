<script lang="ts">
  import { setContext, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { watchlist } from '../stores/watchlistStore';

  const unsubscribe = page.subscribe(($page) => {
    const isAuthenticated = Boolean($page.data?.session?.user?.id);
    watchlist.setAuthStatus(isAuthenticated);
  });

  setContext('watchlist', watchlist);

  onDestroy(unsubscribe);
</script>

<slot />
