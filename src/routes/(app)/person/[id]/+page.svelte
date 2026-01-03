<script lang="ts">
	import { goto } from '$app/navigation';
	import type { TmdbPersonDetails } from '$lib/server/services/tmdb.service';

	let { data }: { data: { person: TmdbPersonDetails } } = $props();
	const person = $derived(data.person);

	function handleCreditClick(mediaType: string, id: number) {
		const getResolvedPath = (path: string) => (path.startsWith('/') ? path : `/${path}`);
		if (mediaType === 'movie') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(getResolvedPath(`/movie/${id}`));
		} else if (mediaType === 'tv') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(getResolvedPath(`/tv/${id}`));
		}
	}
</script>

<div class="min-h-screen bg-background text-foreground">
	<main class="container mx-auto p-4">
		<div class="mb-8 flex flex-col gap-8 md:flex-row">
			<div class="w-full md:w-1/3 lg:w-1/4">
				{#if person.profilePath}
					<img
						src={person.profilePath}
						alt={person.name}
						class="w-full rounded-lg object-cover shadow-lg"
					/>
				{:else}
					<div
						class="flex aspect-2/3 w-full items-center justify-center rounded-lg bg-muted text-muted-foreground"
					>
						No Image
					</div>
				{/if}

				<div class="mt-6 space-y-4">
					<h3 class="text-xl font-semibold">Personal Info</h3>

					{#if person.knownFor?.length}
						<div>
							<span class="font-medium text-muted-foreground">Known For</span>
							<p>{person.knownFor[0].department || 'Acting'}</p>
						</div>
					{/if}

					{#if person.birthday}
						<div>
							<span class="font-medium text-muted-foreground">Born</span>
							<p>{person.birthday}</p>
							{#if person.placeOfBirth}
								<p class="text-sm text-muted-foreground">{person.placeOfBirth}</p>
							{/if}
						</div>
					{/if}

					{#if person.deathday}
						<div>
							<span class="font-medium text-muted-foreground">Died</span>
							<p>{person.deathday}</p>
						</div>
					{/if}
				</div>
			</div>

			<div class="w-full md:w-2/3 lg:w-3/4">
				<h1 class="mb-6 text-4xl font-bold">{person.name}</h1>

				{#if person.biography}
					<section class="mb-8 space-y-4">
						<h2 class="text-2xl font-semibold">Biography</h2>
						<p class="leading-relaxed whitespace-pre-line text-muted-foreground">
							{person.biography}
						</p>
					</section>
				{/if}

				{#if person.knownFor?.length}
					<section>
						<h2 class="mb-4 text-2xl font-semibold">Known For</h2>
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each person.knownFor as credit (credit.id)}
								<button
									class="group relative flex aspect-2/3 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-all hover:scale-105 hover:shadow-xl"
									onclick={() => handleCreditClick(credit.mediaType, credit.id)}
								>
									{#if credit.posterPath}
										<img
											src={credit.posterPath}
											alt={credit.title}
											class="h-full w-full object-cover"
											loading="lazy"
										/>
									{:else}
										<div
											class="flex h-full w-full items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground"
										>
											{credit.title}
										</div>
									{/if}

									<div
										class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent p-3 pt-12 text-left"
									>
										<p class="line-clamp-2 text-sm font-semibold text-white">
											{credit.title}
										</p>
										{#if credit.character}
											<p class="line-clamp-1 text-xs text-gray-300">
												as {credit.character}
											</p>
										{/if}
										{#if credit.job}
											<p class="line-clamp-1 text-xs text-gray-300">
												{credit.job}
											</p>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>
	</main>
</div>
