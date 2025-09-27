<script lang="ts">
  import { setContext } from 'svelte';
  import { theme } from '../stores/themeStore';

  setContext('theme', theme);
</script>

<slot />
