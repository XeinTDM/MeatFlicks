import { toSlug } from '$lib/utils';
import { libraryRepository } from '../repositories/library.repository';
import type { HomeLibrary, LibraryCollection, LibraryGenre } from '$lib/types/library';

export async function fetchHomeLibrary(): Promise<HomeLibrary> {
  const [trendingMovies, collections, genres] = await Promise.all([
    libraryRepository.findTrendingMovies(),
    libraryRepository.listCollections(),
    libraryRepository.listGenres()
  ]);

  const collectionsWithMovies = await Promise.all(
    collections.map(async (collection) => {
      const movies = await libraryRepository.findCollectionMovies(collection.slug);
      return {
        ...collection,
        movies
      } satisfies LibraryCollection;
    })
  );

  const genresWithMovies = await Promise.all(
    genres.map(async (genre) => {
      const movies = await libraryRepository.findGenreMovies(genre.name);
      return {
        ...genre,
        slug: toSlug(genre.name),
        movies
      } satisfies LibraryGenre;
    })
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
