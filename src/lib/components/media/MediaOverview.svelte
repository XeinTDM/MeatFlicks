<script lang="ts">
	import { Card } from '$lib/components/ui/card';

	let {
		cast,
		productionCompanies,
		overview,
		posterPath,
		title
	} = $props<{
		cast: {
			id: number;
			name: string;
			character: string;
			profilePath?: string | null;
		}[] | undefined;

		productionCompanies: {
			id: number;
			name: string;
			logoPath: string | null;
		}[] | undefined;

		overview: string | null;
		posterPath: string | null;
		title: string;
	}>();
</script>

<div class="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
	<div class="flex flex-col gap-4 lg:flex-row">
		<div class="flex-shrink-0 space-y-2 rounded-lg lg:w-[70%]">
			{#if cast?.length}
				<ul class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{#each cast as member (member.id)}
						<li
							class="rounded-lg border border-border/40 bg-background/80 p-4 transition-colors hover:bg-muted/50"
						>
							<a href={`/person/${member.id}`} class="flex items-center gap-3">
								{#if member.profilePath}
									<img
										src={member.profilePath.startsWith('http')
											? member.profilePath
											: `https://image.tmdb.org/t/p/w185${member.profilePath}`}
										alt={member.name}
										class="h-16 w-12 rounded-md object-cover"
										width="48"
										height="64"
									/>
								{:else}
									<div
										class="flex h-16 w-12 items-center justify-center rounded-md bg-muted"
									>
										<span class="text-xs text-muted-foreground">No Image</span>
									</div>
								{/if}
								<div class="flex-1">
									<p class="font-semibold text-foreground hover:underline">
										{member.name}
									</p>
									<p class="text-sm text-muted-foreground">{member.character}</p>
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
										<img
											src={company.logoPath}
											alt={company.name}
											class="h-6 object-contain"
										/>
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
				<img
					src={posterPath}
					alt={title}
					class="mb-4 w-full max-w-sm rounded-lg object-cover"
				/>
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
