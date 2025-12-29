<script lang="ts">
	import { ChevronRight, Home } from '@lucide/svelte';

	type BreadcrumbItem = {
		label: string;
		href: string;
	};

	let { items = [] }: { items?: BreadcrumbItem[] } = $props();

	const breadcrumbItems = $derived.by(() => {
		const allItems = [{ label: 'Home', href: '/' }, ...items];

		return allItems;
	});

	const structuredData = $derived.by(() => {
		const baseUrl = 'https://meatflicks.com';

		return {
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: breadcrumbItems.map((item, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: item.label,
				item: `${baseUrl}${item.href}`
			}))
		};
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<script type="application/ld+json">' + JSON.stringify(structuredData) + '</script>'}
</svelte:head>

<nav aria-label="Breadcrumb" class="mb-4">
	<ol
		class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
		itemscope
		itemtype="https://schema.org/BreadcrumbList"
	>
		{#each breadcrumbItems as item, index (item.href)}
			<li
				itemprop="itemListElement"
				itemscope
				itemtype="https://schema.org/ListItem"
				class="flex items-center gap-2"
			>
				{#if index > 0}
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				{/if}

				{#if index === breadcrumbItems.length - 1}
					<span itemprop="name" class="font-medium text-foreground" aria-current="page">
						{item.label}
					</span>
				{:else}
					<a
						href={`/${item.href}`}
						itemprop="item"
						class="flex items-center gap-1 transition-colors hover:text-foreground"
					>
						{#if index === 0}
							<Home class="h-4 w-4" aria-label="Home" />
						{/if}
						<span itemprop="name">{item.label}</span>
					</a>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
