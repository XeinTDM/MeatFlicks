<script lang="ts">
  import { setContext } from 'svelte';
  import { error } from './errorStore';

  setContext('error', error);
</script>

<slot />
