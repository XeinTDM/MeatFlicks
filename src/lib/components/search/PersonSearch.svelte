<script lang="ts">
	import { Search, User, X, LoaderCircle } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';

	interface PersonSearchResult {
		id: number;
		tmdbId: number;
		name: string;
		profilePath: string | null;
		knownForDepartment: string | null;
		popularity: number;
		biography?: string;
		birthday?: string;
		placeOfBirth?: string;
	}

	interface Props {
		placeholder?: string;
		maxResults?: number;
		selectedPeople?: PersonSearchResult[];
		disabled?: boolean;
	}

	let {
		placeholder = 'Search for actors, directors...',
		maxResults = 5,
		selectedPeople = [],
		disabled = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		personselect: PersonSearchResult;
		personremove: PersonSearchResult;
	}>();

	let query = $state('');
	let results = $state<PersonSearchResult[]>([]);
	let isLoading = $state(false);
	let isFocused = $state(false);
	let searchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let containerRef = $state<HTMLElement | null>(null);

	async function fetchPeople(q: string) {
		if (!q.trim()) {
			results = [];
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(`/api/search/people?q=${encodeURIComponent(q)}&limit=${maxResults}`, {
				credentials: 'include'
			});
			if (res.ok) {
				results = await res.json();
			}
		} catch (error) {
			console.error('[person-search] error', error);
		} finally {
			isLoading = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		query = target.value;

		if (searchTimeout) clearTimeout(searchTimeout);

		if (!query.trim()) {
			results = [];
			isLoading = false;
			return;
		}

		searchTimeout = setTimeout(() => {
			fetchPeople(query);
		}, 300);
	}

	function handlePersonSelect(person: PersonSearchResult) {
		// Check if person is already selected
		if (!selectedPeople.find((p) => p.id === person.id)) {
			dispatch('personselect', person);
			query = '';
			results = [];
			isFocused = false;
		}
	}

	function handleRemovePerson(person: PersonSearchResult) {
		dispatch('personremove', person);
	}

	function clearSearch() {
		query = '';
		results = [];
		isLoading = false;
	}

	// Close on click outside
	$effect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef && !containerRef.contains(e.target as Node)) {
				isFocused = false;
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});
</script>

<div class="relative w-full" bind:this={containerRef}>
	<div class="space-y-3">
		<!-- Selected People -->
		{#if selectedPeople.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each selectedPeople as person (person.id)}
					<div
						class="group flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm"
					>
						{#if person.profilePath}
							<img src={person.profilePath} alt="" class="h-5 w-5 rounded-full object-cover" />
						{:else}
							<User class="h-4 w-4 text-primary" />
						{/if}
						<span class="font-medium">{person.name}</span>
						{#if !disabled}
							<button
								onclick={() => handleRemovePerson(person)}
								class="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20"
								type="button"
							>
								<X class="h-3 w-3" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Search Input -->
		<div
			class="group flex items-center gap-3 rounded-xl border border-border/40 bg-muted/40 px-3 py-2 transition-all duration-300 focus-within:border-primary/50 focus-within:bg-muted/60"
		>
			<Search
				class="size-4 text-muted-foreground transition-colors group-focus-within:text-primary"
			/>
			<input
				type="text"
				{placeholder}
				class="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				value={query}
				oninput={handleInput}
				onfocus={() => (isFocused = true)}
				{disabled}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						isFocused = false;
					}
				}}
			/>
			{#if query}
				<button
					onclick={clearSearch}
					class="rounded-full p-1 transition-colors hover:bg-muted"
					type="button"
					{disabled}
				>
					<X class="size-3 text-muted-foreground" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Search Results Dropdown -->
	{#if isFocused && (results.length > 0 || isLoading)}
		<div
			class="absolute top-full right-0 left-0 z-[100] mt-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
		>
			{#if isLoading}
				<div class="flex items-center justify-center p-4">
					<LoaderCircle class="size-5 animate-spin text-primary" />
				</div>
			{:else if results.length > 0}
				<ul class="space-y-1">
					{#each results as person}
						<li>
							<button
								onclick={() => handlePersonSelect(person)}
								class="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-primary/10"
								type="button"
							>
								<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
									{#if person.profilePath}
										<img src={person.profilePath} alt="" class="h-full w-full object-cover" />
									{:else}
										<div class="flex h-full w-full items-center justify-center">
											<User class="h-5 w-5 text-muted-foreground" />
										</div>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<h4
										class="truncate text-sm font-semibold transition-colors group-hover:text-primary"
									>
										{person.name}
									</h4>
									{#if person.knownForDepartment}
										<p class="truncate text-xs text-muted-foreground">
											{person.knownForDepartment}
										</p>
									{/if}
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
