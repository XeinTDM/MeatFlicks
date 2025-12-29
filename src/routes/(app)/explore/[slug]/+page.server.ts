import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug, toSlug } from '$lib/utils';
import { parseAllFromURL } from '$lib/utils/filterUrl';
import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginationParams } from '$lib/types/pagination';
import { DEFAULT_PAGE_SIZE } from '$lib/types/pagination';

const CATEGORY_PRESETS: Record<string, { title: string; genres: string[] }> = {
	movies: {
		title: 'Movies',
		genres: ['Action', 'Comedy', 'Drama', 'Horror', 'Science Fiction', 'Thriller']
	},
	'tv-shows': {
		title: 'TV Shows',
		genres: ['Animation', 'Documentary', 'Family', 'Kids', 'Mystery', 'Reality']
	}
};

export const load: PageServerLoad = async ({ params, url }) => {
	const { slug } = params;
	const { filters, sort, pagination, include_anime } = parseAllFromURL(url.searchParams);

	const hasActiveFilters =
		filters.yearFrom ||
		filters.yearTo ||
		filters.minRating !== undefined ||
		filters.maxRating !== undefined ||
		filters.runtimeMin !== undefined ||
		filters.runtimeMax !== undefined ||
		filters.language ||
		(filters.genres && filters.genres.length > 0);

	const preset = CATEGORY_PRESETS[slug];
	let categoryTitle = preset?.title ?? '';
	let genresToFetch = preset?.genres ?? [];
	let singleGenreMode = false;

	if (!preset) {
		const genres = await libraryRepository.listGenres();
		const match = genres.find((genre) => toSlug(genre.name) === slug);

		if (!match) {
			if (hasActiveFilters) {
				const mediaType = slug === 'tv-shows' ? 'tv' : 'movie';
				const result = await libraryRepository.findMoviesWithFilters(filters, sort, pagination, mediaType, include_anime);
				const availableGenres = await libraryRepository.listGenres();
				return {
					categoryTitle: fromSlug(slug),
					movies: result.items,
					pagination: result.pagination,
					filters,
					sort,
					hasContent: result.items.length > 0,
					singleGenreMode: true,
					availableGenres,
					useFilters: true,
					include_anime
				};
			}

			return {
				categoryTitle: fromSlug(slug),
				genreData: [],
				hasContent: false,
				singleGenreMode: true,
				availableGenres: await libraryRepository.listGenres(),
				useFilters: false,
				include_anime
			};
		}

		categoryTitle = match.name;
		genresToFetch = [match.name];
		singleGenreMode = true;
	}

	if (hasActiveFilters) {
		const finalFilters: MovieFilters = { ...filters };
		if (singleGenreMode && genresToFetch.length === 1) {
			finalFilters.genres = [genresToFetch[0], ...(finalFilters.genres || [])];
		}

		const mediaType = slug === 'tv-shows' ? 'tv' : 'movie';
		const result = await libraryRepository.findMoviesWithFilters(finalFilters, sort, pagination, mediaType, include_anime);
		const availableGenres = await libraryRepository.listGenres();

		return {
			categoryTitle,
			movies: result.items,
			pagination: result.pagination,
			filters: finalFilters,
			sort,
			hasContent: result.items.length > 0,
			singleGenreMode,
			availableGenres,
			useFilters: true,
			include_anime
		};
	}

	const genreData = await Promise.all(
		genresToFetch.map(async (genreName) => ({
			genre: genreName,
			slug: toSlug(genreName),
			movies: await libraryRepository.findGenreMovies(genreName, undefined, undefined, slug === 'tv-shows' ? 'tv' : 'movie', include_anime)
		}))
	);

	const hasContent = genreData.some((entry) => entry.movies.length > 0);
	const availableGenres = await libraryRepository.listGenres();

	return {
		categoryTitle,
		genreData,
		hasContent,
		singleGenreMode,
		availableGenres,
		useFilters: false,
		filters: {} as MovieFilters,
		sort: { field: 'popularity', order: 'desc' } as SortOptions,
		pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE } as PaginationParams,
		include_anime
	};
};
