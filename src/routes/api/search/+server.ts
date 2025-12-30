import { json, type RequestHandler } from '@sveltejs/kit';
import { withCache, buildCacheKey, CACHE_TTL_SHORT_SECONDS } from '$lib/server/cache';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import type { LibraryMovie } from '$lib/types/library';
import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginationParams } from '$lib/types/pagination';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const pageParam = url.searchParams.get('page');
	const limitParam = url.searchParams.get('limit');


	const page = pageParam ? parseInt(pageParam) : 1;
	const limit = limitParam ? parseInt(limitParam) : 24;

	if (!query || query.trim() === '') {
		const cacheKey = buildCacheKey('search', 'all', page, limit);

		const results = await withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
			try {
				const paginationParams: PaginationParams = {
					page,
					pageSize: limit
				};

				const sortOptions: SortOptions = {
					field: 'rating',
					order: 'desc'
				};

				const emptyFilters: MovieFilters = {};

				const moviesResult = await libraryRepository.findMoviesWithFilters(
					emptyFilters,
					sortOptions,
					paginationParams,
					'movie',
					'include'
				);

				const tvResult = await libraryRepository.findMoviesWithFilters(
					emptyFilters,
					sortOptions,
					paginationParams,
					'tv',
					'include'
				);

				const allResults = [...moviesResult.items, ...tvResult.items].slice(0, limit);

				return allResults;
			} catch (error) {
				console.error('Error fetching all media:', error);
				return [];
			}
		});

		return json(results);
	}

	const cacheKey = buildCacheKey('search', 'multi', query, page, limit);

	const results = await withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
		const response = await fetch(
			`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
				query
			)}&include_adult=false&language=en-US&page=${page}`,
			{
				headers: {
					Authorization: `Bearer ${process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN}`
				}
			}
		);

		if (!response.ok) {
			console.error(`TMDB API responded with status ${response.status}`);
			return [];
		}

		const data = await response.json();

		if (!data.results || !Array.isArray(data.results)) {
			return [];
		}

		const formattedResults: LibraryMovie[] = data.results
			.filter(
				(item: any) => ['movie', 'tv'].includes(item.media_type) && item.popularity > 1
			)
			.slice(0, limit)
			.map((item: any) => {
				const posterPath = item.poster_path || item.profile_path;
				return {
					id: String(item.id),
					title: item.title || item.name,
					overview: item.overview || '',
					posterPath: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
					backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
					releaseDate: item.release_date || item.first_air_date || null,
					rating: item.vote_average ? item.vote_average / 2 : null,
					durationMinutes: null,
					is4K: false,
					isHD: true,
					collectionId: null,
					trailerUrl: null,
					imdbId: null,
					canonicalPath: null,
					addedAt: null,
					mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
					genres: [],
					tmdbId: item.id,
					media_type: item.media_type
				};
			});

		return formattedResults;
	});

	return json(results);
};
