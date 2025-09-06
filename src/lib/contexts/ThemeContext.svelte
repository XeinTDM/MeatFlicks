<script lang="ts">
  import { setContext } from 'svelte';
  import { theme } from './themeStore';

  setContext('theme', theme);
</script>

<slot />
