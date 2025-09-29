<script lang="ts">
	import { setContext } from 'svelte';
	import { error } from '../stores/errorStore';

	setContext('error', error);
</script>

<slot />
