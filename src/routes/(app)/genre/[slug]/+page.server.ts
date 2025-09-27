import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug, toSlug } from '$lib/utils';

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;
  const genres = await libraryRepository.listGenres();
  const match = genres.find((genre) => toSlug(genre.name) === slug);

  if (!match) {
    return {
      genreTitle: fromSlug(slug),
      movies: [],
      hasContent: false
    };
  }

  const movies = await libraryRepository.findGenreMovies(match.name);

  return {
    genreTitle: match.name,
    movies,
    hasContent: movies.length > 0
  };
};
