<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';

	let { form } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<div class="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
		<h1 class="mb-6 text-center text-2xl font-bold">Create an Account</h1>

		<form method="POST" use:enhance class="space-y-4">
			<div class="space-y-2">
				<label for="username" class="text-sm leading-none font-medium">Username</label>
				<input
					id="username"
					name="username"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-sm leading-none font-medium">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			{#if form?.message}
				<p class="text-sm font-medium text-destructive">{form.message}</p>
			{/if}

			<Button type="submit" class="w-full">Sign Up</Button>

			<p class="text-center text-sm text-muted-foreground">
				Already have an account? <a href="/login" class="underline hover:text-primary">Log in</a>
			</p>
		</form>
	</div>
</div>
