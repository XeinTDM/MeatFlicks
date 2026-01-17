<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as Avatar from '$lib/components/ui/avatar';
	import { SidebarMenuButton } from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { History, Bookmark, Settings, LogIn, LogOut } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { onOpenSettings } = $props<{ onOpenSettings: () => void }>();

	let pfpUrl = $state('');
	type UserRecord = Record<string, unknown> | null | undefined;
	const resolveDisplayName = (user: UserRecord) => {
		if (!user) return 'Guest';
		const candidate =
			(typeof user.name === 'string' && user.name) ||
			(typeof user.username === 'string' && user.username) ||
			(typeof user.email === 'string' && user.email);
		return candidate || 'User';
	};

	onMount(() => {
		const storedPfp = localStorage.getItem('userParams');
		if (storedPfp) {
			try {
				const data = JSON.parse(storedPfp);
				if (data.avatar) pfpUrl = data.avatar;
			} catch (e) {
				console.error('Error parsing user data', e);
			}
		}

		if (!pfpUrl) {
			const seed = Math.random().toString(36).substring(7);
			pfpUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
			localStorage.setItem('userParams', JSON.stringify({ avatar: pfpUrl }));
		}
	});

	async function handleNavigate(path: string) {
		const getResolvedPath = (p: string) => (p.startsWith('/') ? p : `/${p}`);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(getResolvedPath(path));
	}
</script>

<Popover.Root>
	{@const currentUser = page.data.user as UserRecord}
	{@const isAuthenticated = Boolean(currentUser)}
	{@const displayName = resolveDisplayName(currentUser)}
	<Popover.Trigger>
		{#snippet child({ props })}
			<SidebarMenuButton
				{...props}
				class="h-12 w-12 overflow-hidden rounded-full p-0 hover:bg-transparent data-[state=open]:bg-transparent"
			>
				<Avatar.Root class="h-12 w-12 cursor-pointer transition-transform hover:scale-105">
					<Avatar.Image src={pfpUrl} alt="User" />
					<Avatar.Fallback>HU</Avatar.Fallback>
				</Avatar.Root>
			</SidebarMenuButton>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content side="right" align="end" class="w-56 p-2">
		<div class="mb-2 flex items-center gap-2 p-2">
			<Avatar.Root class="h-8 w-8">
				<Avatar.Image src={pfpUrl} alt="User" />
				<Avatar.Fallback>HU</Avatar.Fallback>
			</Avatar.Root>
			<div class="flex flex-col">
				<span class="text-sm font-medium">{displayName}</span>
				{#if isAuthenticated}
					<span class="text-xs text-muted-foreground">Signed in</span>
				{:else}
					<span class="text-xs text-muted-foreground">Sign in to sync</span>
				{/if}
			</div>
		</div>

		{#if !isAuthenticated}
			<Button
				variant="default"
				class="mb-2 w-full justify-start"
				size="sm"
				onclick={() => handleNavigate('/login')}
			>
				<LogIn class="mr-2 h-4 w-4" />
				Login
			</Button>
		{:else}
			<form method="post" action="/auth/logout" class="mb-2 w-full">
					{#if page.data.csrfToken}
						<input type="hidden" name="csrf_token" value={page.data.csrfToken} />
					{/if}
				<Button variant="ghost" class="w-full justify-start" size="sm" type="submit">
					<LogOut class="mr-2 h-4 w-4" />
					Logout
				</Button>
			</form>
		{/if}
		<Separator class="my-2" />

		<div class="grid gap-1">
			<Button
				variant="ghost"
				class="w-full justify-start text-foreground"
				size="sm"
				onclick={() => handleNavigate('/history')}
			>
				<History class="mr-2 h-4 w-4" />
				History
			</Button>
			<Button
				variant="ghost"
				class="w-full justify-start text-foreground"
				size="sm"
				onclick={() => handleNavigate('/watchlist')}
			>
				<Bookmark class="mr-2 h-4 w-4" />
				Watchlist
			</Button>
			<Separator class="my-2" />
			<Button variant="ghost" class="w-full justify-start" size="sm" onclick={onOpenSettings}>
				<Settings class="mr-2 h-4 w-4 text-muted-foreground" />
				Settings
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>
