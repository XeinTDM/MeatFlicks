import type { PageServerLoad } from './$types';
import { getTrendingMovies, getCollections, getGenres, getMoviesByCollection, getMoviesByGenre } from '$lib/api';
import { createCollectionSlug } from '$lib/utils';

export const load: PageServerLoad = async () => {
  try {
    const trendingMovies = await getTrendingMovies();
    const collections = await getCollections();
    const genres = await getGenres();

    const collectionsWithMovies = await Promise.all(
      collections.map(async (collection) => {
        const movies = await getMoviesByCollection(createCollectionSlug(collection.name));
        return { ...collection, movies };
      })
    );

    const genresWithMovies = await Promise.all(
      genres.map(async (genre) => {
        const movies = await getMoviesByGenre(genre.name);
        return { ...genre, movies };
      })
    );

    return {
      trendingMovies,
      collections: collectionsWithMovies,
      genres: genresWithMovies,
    };
  } catch (error) {
    console.error('Error loading data:', error);
    return {
      trendingMovies: [],
      collections: [],
      genres: [],
    };
  }
};
