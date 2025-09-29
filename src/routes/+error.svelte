<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
	<div class="rounded-lg bg-card p-8 text-center shadow-xl">
		<h1 class="mb-4 text-4xl font-bold text-destructive">Oops!</h1>
		<p class="mb-6 text-lg text-muted-foreground">
			{$page.error?.message ||
				'Something went wrong. Please try again later or contact support if the problem persists.'}
		</p>
		<div class="flex justify-center gap-4">
			<button
				on:click={() => window.history.back()}
				class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
				>Go Back</button
			>
			<Button href="/">Go Home</Button>
		</div>
	</div>
</div>
