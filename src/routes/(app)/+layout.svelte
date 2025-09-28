<script lang="ts">
  import '../../app.css';

  import AppShell from '$lib/components/Sidebar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import GlobalErrorDisplay from '$lib/components/GlobalErrorDisplay.svelte';
  import ThemeContext from '$lib/state/contexts/ThemeContext.svelte';
  import WatchlistContext from '$lib/state/contexts/WatchlistContext.svelte';
  import ErrorContext from '$lib/state/contexts/ErrorContext.svelte';
  import { ModeWatcher } from 'mode-watcher';
</script>

<svelte:head>
  <title>MeatFlicks - Your Ultimate Streaming</title>
  <meta
    name="description"
    content="Discover and stream your favorite movies and TV shows on MeatFlicks."
  />
</svelte:head>

<ModeWatcher />
<ThemeContext>
  <WatchlistContext>
    <ErrorContext>
      <AppShell>
        <div class="flex min-h-svh flex-col text-foreground">
          <slot />
          <Footer />
        </div>
      </AppShell>
      <GlobalErrorDisplay />
    </ErrorContext>
  </WatchlistContext>
</ThemeContext>
