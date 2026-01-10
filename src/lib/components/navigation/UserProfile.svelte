<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import * as Avatar from '$lib/components/ui/avatar';
	import { SidebarMenuButton } from '$lib/components/ui/sidebar';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { History, Bookmark, Settings, LogIn } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { onOpenSettings } = $props<{ onOpenSettings: () => void }>();

	let pfpUrl = $state('');
	let isAuthenticated = $state(false);

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
				<span class="text-sm font-medium">{isAuthenticated ? 'User' : 'Guest'}</span>
				{#if !isAuthenticated}<span class="text-xs text-muted-foreground">Sign in to sync</span
					>{/if}
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
			<Separator class="my-2" />
		{/if}

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
