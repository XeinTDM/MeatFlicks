export interface PaginationParams {
	page: number;
	pageSize: number;
}

export interface PaginationMetadata {
	currentPage: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startIndex: number;
	endIndex: number;
}

export interface PaginatedResult<T> {
	items: T[];
	pagination: PaginationMetadata;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 5;

export function calculatePagination(
	page: number,
	pageSize: number,
	totalItems: number
): PaginationMetadata {
	const normalizedPage = Math.max(1, Math.floor(page));
	const normalizedPageSize = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
	const normalizedTotal = Math.max(0, Math.floor(totalItems));
	const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize));
	const currentPage = Math.min(normalizedPage, totalPages);
	const startIndex = (currentPage - 1) * normalizedPageSize;
	const endIndex = Math.min(startIndex + normalizedPageSize - 1, normalizedTotal - 1);

	return {
		currentPage,
		pageSize: normalizedPageSize,
		totalItems: normalizedTotal,
		totalPages,
		hasNextPage: currentPage < totalPages,
		hasPreviousPage: currentPage > 1,
		startIndex,
		endIndex
	};
}

export function calculateOffset(page: number, pageSize: number): number {
	const normalizedPage = Math.max(1, Math.floor(page));
	const normalizedPageSize = Math.max(MIN_PAGE_SIZE, Math.floor(pageSize));
	return (normalizedPage - 1) * normalizedPageSize;
}

export function generatePageNumbers(
	currentPage: number,
	totalPages: number,
	maxVisible: number = 7
): (number | 'ellipsis')[] {
	if (totalPages <= maxVisible) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const pages: (number | 'ellipsis')[] = [];
	const halfVisible = Math.floor(maxVisible / 2);

	pages.push(1);

	let startPage = Math.max(2, currentPage - halfVisible);
	let endPage = Math.min(totalPages - 1, currentPage + halfVisible);

	if (currentPage <= halfVisible + 1) {
		endPage = Math.min(totalPages - 1, maxVisible - 1);
	}

	if (currentPage >= totalPages - halfVisible) {
		startPage = Math.max(2, totalPages - maxVisible + 2);
	}

	if (startPage > 2) {
		pages.push('ellipsis');
	}

	for (let i = startPage; i <= endPage; i++) {
		pages.push(i);
	}

	if (endPage < totalPages - 1) {
		pages.push('ellipsis');
	}

	if (totalPages > 1) {
		pages.push(totalPages);
	}

	return pages;
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
	const page = parseInt(searchParams.get('page') || '1', 10);
	const pageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

	return {
		page: Math.max(1, page),
		pageSize: Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize))
	};
}

export function createPaginationParams(params: PaginationParams): URLSearchParams {
	const searchParams = new URLSearchParams();
	if (params.page > 1) {
		searchParams.set('page', String(params.page));
	}
	if (params.pageSize !== DEFAULT_PAGE_SIZE) {
		searchParams.set('pageSize', String(params.pageSize));
	}
	return searchParams;
}
