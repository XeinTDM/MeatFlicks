import { createCollectionSlug } from '$lib/utils';
import { libraryRepository } from '../repositories/library.repository';

export async function fetchHomeLibrary() {
  const [trendingMovies, collections, genres] = await Promise.all([
    libraryRepository.findTrendingMovies(),
    libraryRepository.listCollections(),
    libraryRepository.listGenres()
  ]);

  const collectionsWithMovies = await Promise.all(
    collections.map(async (collection) => ({
      ...collection,
      movies: await libraryRepository.findCollectionMovies(createCollectionSlug(collection.name))
    }))
  );

  const genresWithMovies = await Promise.all(
    genres.map(async (genre) => ({
      ...genre,
      movies: await libraryRepository.findGenreMovies(genre.name)
    }))
  );

  return {
    trendingMovies,
    collections: collectionsWithMovies,
    genres: genresWithMovies
  };
}

export const libraryService = {
  fetchHomeLibrary
};