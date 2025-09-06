<script lang="ts">
  import '../app.css';
  import '../routes/globals.css';
  
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import GlobalErrorDisplay from '$lib/components/GlobalErrorDisplay.svelte';
  import ThemeContext from '$lib/contexts/ThemeContext.svelte';
  import WatchlistContext from '$lib/contexts/WatchlistContext.svelte';
  import ErrorContext from '$lib/contexts/ErrorContext.svelte';
</script>

<svelte:head>
  <title>MeatFlicks - Your Ultimate Streaming Guide</title>
  <meta name="description" content="Discover and stream your favorite movies and TV shows on MeatFlicks." />
</svelte:head>

<ThemeContext>
  <WatchlistContext>
    <ErrorContext>
      <div class="h-full w-full h-full min-h-screen w-full bg-bg-color text-text-color">
          <Header />
          <slot />
          <Footer />
          <GlobalErrorDisplay />
      </div>
    </ErrorContext>
  </WatchlistContext>
</ThemeContext>