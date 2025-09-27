import type { PageServerLoad } from './$types';
import { libraryService } from '$lib/server';

export const load: PageServerLoad = async () => {
  try {
    const { trendingMovies, collections, genres } = await libraryService.fetchHomeLibrary();

    return {
      trendingMovies,
      collections,
      genres
    };
  } catch (error) {
    console.error('Error loading data:', error);
    return {
      trendingMovies: [],
      collections: [],
      genres: []
    };
  }
};