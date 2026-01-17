/**
 * Resolves an image path to a proxy URL or returns the absolute URL as is.
 * @param path The image path (relative starting with / or absolute)
 * @param width Optional width (e.g., 'w500', 'original')
 * @returns The resolved image URL
 */
export function getImageUrl(path: string | null | undefined, width: string = 'original'): string {
	if (!path) return '';
	if (path.startsWith('http')) return path;

	// Ensure path starts with / for consistency
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;

	// Route through our server-side image proxy
	return `/api/images${normalizedPath}?w=${width}`;
}
