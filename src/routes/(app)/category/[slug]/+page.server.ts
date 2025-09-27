import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug, toSlug } from '$lib/utils';

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

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  const preset = CATEGORY_PRESETS[slug];
  let categoryTitle = preset?.title ?? '';
  let genresToFetch = preset?.genres ?? [];
  let singleGenreMode = false;

  if (!preset) {
    const genres = await libraryRepository.listGenres();
    const match = genres.find((genre) => toSlug(genre.name) === slug);

    if (!match) {
      return {
        categoryTitle: fromSlug(slug),
        genreData: [],
        hasContent: false,
        singleGenreMode: true
      };
    }

    categoryTitle = match.name;
    genresToFetch = [match.name];
    singleGenreMode = true;
  }

  const genreData = await Promise.all(
    genresToFetch.map(async (genreName) => ({
      genre: genreName,
      slug: toSlug(genreName),
      movies: await libraryRepository.findGenreMovies(genreName)
    }))
  );

  const hasContent = genreData.some((entry) => entry.movies.length > 0);

  return {
    categoryTitle,
    genreData,
    hasContent,
    singleGenreMode
  };
};
