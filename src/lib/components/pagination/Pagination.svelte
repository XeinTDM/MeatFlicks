<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight,
		MoreHorizontal
	} from '@lucide/svelte';
	import type { PaginationMetadata } from '$lib/types/pagination';
	import { generatePageNumbers } from '$lib/types/pagination';

	interface Props {
		pagination: PaginationMetadata;
		onPageChange: (page: number) => void;
		maxVisible?: number;
	}

	let { pagination, onPageChange, maxVisible = 7 }: Props = $props();

	let pageNumbers = $derived(
		generatePageNumbers(pagination.currentPage, pagination.totalPages, maxVisible)
	);

	function goToPage(page: number) {
		if (page >= 1 && page <= pagination.totalPages && page !== pagination.currentPage) {
			onPageChange(page);
		}
	}

	function goToFirstPage() {
		goToPage(1);
	}

	function goToLastPage() {
		goToPage(pagination.totalPages);
	}

	function goToPreviousPage() {
		goToPage(pagination.currentPage - 1);
	}

	function goToNextPage() {
		goToPage(pagination.currentPage + 1);
	}
</script>

<nav class="flex items-center justify-between gap-4" aria-label="Pagination">
	<!-- Results info -->
	<div class="hidden text-sm text-muted-foreground sm:block">
		Showing <span class="font-medium">{pagination.startIndex + 1}</span> to
		<span class="font-medium">{Math.min(pagination.endIndex + 1, pagination.totalItems)}</span>
		of <span class="font-medium">{pagination.totalItems}</span> results
	</div>

	<!-- Pagination controls -->
	<div class="flex items-center gap-1">
		<!-- First page -->
		<Button
			variant="outline"
			size="icon"
			onclick={goToFirstPage}
			disabled={!pagination.hasPreviousPage}
			class="hidden h-8 w-8 sm:inline-flex"
			aria-label="Go to first page"
		>
			<ChevronsLeft class="h-4 w-4" />
		</Button>

		<!-- Previous page -->
		<Button
			variant="outline"
			size="icon"
			onclick={goToPreviousPage}
			disabled={!pagination.hasPreviousPage}
			class="h-8 w-8"
			aria-label="Go to previous page"
		>
			<ChevronLeft class="h-4 w-4" />
		</Button>

		<!-- Page numbers -->
		<div class="flex items-center gap-1">
			{#each pageNumbers as page}
				{#if page === 'ellipsis'}
					<div class="flex h-8 w-8 items-center justify-center">
						<MoreHorizontal class="h-4 w-4 text-muted-foreground" />
					</div>
				{:else}
					<Button
						variant={page === pagination.currentPage ? 'default' : 'outline'}
						size="icon"
						onclick={() => goToPage(page)}
						class="h-8 w-8"
						aria-label={`Go to page ${page}`}
						aria-current={page === pagination.currentPage ? 'page' : undefined}
					>
						{page}
					</Button>
				{/if}
			{/each}
		</div>

		<!-- Next page -->
		<Button
			variant="outline"
			size="icon"
			onclick={goToNextPage}
			disabled={!pagination.hasNextPage}
			class="h-8 w-8"
			aria-label="Go to next page"
		>
			<ChevronRight class="h-4 w-4" />
		</Button>

		<!-- Last page -->
		<Button
			variant="outline"
			size="icon"
			onclick={goToLastPage}
			disabled={!pagination.hasNextPage}
			class="hidden h-8 w-8 sm:inline-flex"
			aria-label="Go to last page"
		>
			<ChevronsRight class="h-4 w-4" />
		</Button>
	</div>

	<!-- Mobile results info -->
	<div class="text-sm text-muted-foreground sm:hidden">
		Page {pagination.currentPage} of {pagination.totalPages}
	</div>
</nav>
