<script lang="ts">
	import { notifications, type Notification } from '$lib/state/stores/notificationStore';
	import { X, Info, CircleCheckBig, TriangleAlert, CircleAlert, Sparkles } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	function getIcon(type: Notification['type']) {
		switch (type) {
			case 'info':
				return Info;
			case 'success':
				return CircleCheckBig;
			case 'warning':
				return TriangleAlert;
			case 'error':
				return CircleAlert;
			case 'movie-added':
				return Sparkles;
			default:
				return Info;
		}
	}

	function getColors(type: Notification['type']) {
		switch (type) {
			case 'info':
				return 'bg-blue-500/10 border-blue-500/50 text-blue-400';
			case 'success':
				return 'bg-green-500/10 border-green-500/50 text-green-400';
			case 'warning':
				return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400';
			case 'error':
				return 'bg-red-500/10 border-red-500/50 text-red-400';
			case 'movie-added':
				return 'bg-purple-500/10 border-purple-500/50 text-purple-400';
			default:
				return 'bg-card/80 border-border text-foreground';
		}
	}
</script>

<div
	class="pointer-events-none fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-3"
	aria-live="polite"
>
	{#each $notifications as notification (notification.id)}
		<div
			animate:flip={{ duration: 300 }}
			in:fly={{ x: 50, duration: 400 }}
			out:fade={{ duration: 200 }}
			class="pointer-events-auto"
		>
			<div
				class="relative flex gap-4 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all hover:scale-[1.02] {getColors(
					notification.type
				)}"
			>
				<div class="mt-0.5">
					<svelte:component this={getIcon(notification.type)} class="size-5" />
				</div>

				<div class="min-w-0 flex-1">
					<h4 class="text-sm font-bold tracking-tight">{notification.title}</h4>
					<p class="mt-1 truncate text-xs leading-relaxed opacity-80">
						{notification.message}
					</p>

					{#if notification.type === 'movie-added' && notification.metadata?.posterPath}
						<div class="mt-3 aspect-video h-20 overflow-hidden rounded-lg">
							<img
								src={notification.metadata.posterPath}
								alt=""
								class="h-full w-full object-cover"
							/>
						</div>
					{/if}
				</div>

				<button
					onclick={() => notifications.remove(notification.id)}
					class="rounded-full p-1 transition-colors hover:bg-black/20"
					aria-label="Close notification"
				>
					<X class="size-4" />
				</button>
			</div>
		</div>
	{/each}
</div>
