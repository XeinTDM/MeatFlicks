/**
 * Pagination types for content discovery
 */

export interface PaginationParams {
    /** Current page number (1-indexed) */
    page: number;
    /** Number of items per page */
    pageSize: number;
}

export interface PaginationMetadata {
    /** Current page number (1-indexed) */
    currentPage: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of items across all pages */
    totalItems: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNextPage: boolean;
    /** Whether there is a previous page */
    hasPreviousPage: boolean;
    /** Index of first item on current page (0-indexed) */
    startIndex: number;
    /** Index of last item on current page (0-indexed) */
    endIndex: number;
}

export interface PaginatedResult<T> {
    /** Array of items for current page */
    items: T[];
    /** Pagination metadata */
    pagination: PaginationMetadata;
}

/**
 * Default pagination settings
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 5;

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
    page: number,
    pageSize: number,
    totalItems: number
): PaginationMetadata {
    // Normalize inputs
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(
        MIN_PAGE_SIZE,
        Math.min(MAX_PAGE_SIZE, Math.floor(pageSize))
    );
    const normalizedTotal = Math.max(0, Math.floor(totalItems));

    // Calculate values
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

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, pageSize: number): number {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(MIN_PAGE_SIZE, Math.floor(pageSize));
    return (normalizedPage - 1) * normalizedPageSize;
}

/**
 * Generate page numbers for pagination UI
 */
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

    // Always show first page
    pages.push(1);

    let startPage = Math.max(2, currentPage - halfVisible);
    let endPage = Math.min(totalPages - 1, currentPage + halfVisible);

    // Adjust if we're near the start
    if (currentPage <= halfVisible + 1) {
        endPage = Math.min(totalPages - 1, maxVisible - 1);
    }

    // Adjust if we're near the end
    if (currentPage >= totalPages - halfVisible) {
        startPage = Math.max(2, totalPages - maxVisible + 2);
    }

    // Add ellipsis after first page if needed
    if (startPage > 2) {
        pages.push('ellipsis');
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
        pages.push('ellipsis');
    }

    // Always show last page
    if (totalPages > 1) {
        pages.push(totalPages);
    }

    return pages;
}

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

    return {
        page: Math.max(1, page),
        pageSize: Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize))
    };
}

/**
 * Create URL search params from pagination
 */
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
