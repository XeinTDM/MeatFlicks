<script lang="ts">
  import MovieCardSkeleton from './MovieCardSkeleton.svelte';
</script>

<div class="flex gap-4 overflow-hidden px-[5%] py-8">
  {#each Array(4) as _, index (index)}
    <MovieCardSkeleton />
  {/each}
</div>
