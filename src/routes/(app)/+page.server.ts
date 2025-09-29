import type { PageServerLoad } from './$types';
import { libraryService } from '$lib/server';

export const load: PageServerLoad = async () => {
	const { trendingMovies, collections, genres } = await libraryService.fetchHomeLibrary();

	return {
		trendingMovies,
		collections,
		genres
	};
};
