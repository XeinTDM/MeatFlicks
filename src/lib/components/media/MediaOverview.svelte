<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { User } from '@lucide/svelte';

	let { cast, productionCompanies, overview, posterPath, title } = $props<{
		cast:
			| {
					id: number;
					name: string;
					character: string;
					profilePath?: string | null;
			  }[]
			| undefined;

		productionCompanies:
			| {
					id: number;
					name: string;
					logoPath: string | null;
			  }[]
			| undefined;

		overview: string | null;
		posterPath: string | null;
		title: string;
	}>();
</script>

<div class="px-[5%] py-8">
	<div class="flex flex-col gap-4 lg:flex-row">
		<div class="flex-shrink-0 space-y-2 rounded-lg lg:w-[70%]">
			{#if cast?.length}
				<ul class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{#each cast as member (member.id)}
						<li
							class="group/cast rounded-lg border border-border/40 bg-background/80 p-3 transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-lg"
						>
							<a href={`/person/${member.id}`} class="flex items-center gap-4">
								<div class="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-md shadow-sm">
									{#if member.profilePath}
										<img
											src={member.profilePath.startsWith('http')
												? member.profilePath
												: `https://image.tmdb.org/t/p/w185${member.profilePath}`}
											alt={member.name}
											class="h-full w-full object-cover transition-transform duration-300 group-hover/cast:scale-110"
											loading="lazy"
											width="48"
											height="64"
										/>
									{:else}
										<div
											class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
										>
											<User class="h-6 w-6 opacity-50" />
										</div>
									{/if}
								</div>
								<div class="flex min-w-0 flex-1 flex-col justify-center">
									<p
										class="truncate font-semibold text-foreground transition-colors group-hover/cast:text-primary"
									>
										{member.name}
									</p>
									<p class="truncate text-xs text-muted-foreground">{member.character}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}

			{#if productionCompanies?.length}
				<div class="mt-6">
					<h2 class="mb-4 text-xl font-semibold">Production Companies</h2>
					<div class="flex flex-wrap gap-4">
						{#each productionCompanies as company (company.id)}
							<Card class="p-3">
								<div class="flex items-center gap-2">
									{#if company.logoPath}
										<img src={company.logoPath} alt={company.name} class="h-6 object-contain" />
									{/if}
									<span class="text-sm font-medium">{company.name}</span>
								</div>
							</Card>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		<div class="flex flex-col items-center lg:w-[30%] lg:items-end">
			{#if posterPath}
				<img src={posterPath} alt={title} class="mb-4 w-full max-w-sm rounded-lg object-cover" />
			{/if}
			<div class="w-full max-w-sm">
				<h2 class="text-xl font-semibold">Overview</h2>
				<p class="text-sm text-muted-foreground">
					{overview ?? 'No overview available.'}
				</p>
			</div>
		</div>
	</div>
</div>
