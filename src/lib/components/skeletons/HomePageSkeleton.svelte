<div class="flex flex-col gap-12 animate-pulse">
	<!-- Hero Skeleton -->
	<div class="relative min-h-[60vh] w-full bg-muted/30 md:min-h-[65vh] lg:min-h-[70vh]">
		<div class="absolute inset-0 flex items-end px-[10%] py-12">
			<div class="w-full max-w-2xl space-y-6">
				<div class="h-12 w-3/4 rounded-lg bg-muted/50"></div>
				<div class="flex gap-3">
					<div class="h-6 w-20 rounded-full bg-muted/40"></div>
					<div class="h-6 w-32 rounded-full bg-muted/40"></div>
					<div class="h-6 w-16 rounded-full bg-muted/40"></div>
				</div>
				<div class="space-y-2">
					<div class="h-4 w-full rounded bg-muted/40"></div>
					<div class="h-4 w-5/6 rounded bg-muted/40"></div>
					<div class="h-4 w-4/6 rounded bg-muted/40"></div>
				</div>
				<div class="flex gap-4">
					<div class="h-11 w-32 rounded bg-muted/50"></div>
					<div class="h-11 w-11 rounded-full bg-muted/50"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Content Rows Skeleton -->
	<div class="space-y-12 px-6 sm:px-5 lg:px-5">
		{#each Array(3) as _}
			<div class="space-y-4">
				<div class="h-8 w-48 rounded bg-muted/50"></div>
				<div class="flex gap-4 overflow-hidden">
					{#each Array(6) as _}
						<div class="aspect-[2/3] w-40 shrink-0 rounded-lg bg-muted/40"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>