import type { PageServerLoad } from './$types';
import type { Movie } from '@prisma/client';

async function getMoviesByGenre(genreName: string): Promise<Movie[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/genres/${genreName}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch movies for genre ${genreName}`);
  }
  return res.json();
}

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  let categoryTitle = '';
  let genresToFetch: string[] = [];
  let singleGenreMode = false;

  if (slug === 'movies') {
    categoryTitle = 'Movies';
    genresToFetch = ['Action', 'Comedy', 'Drama', 'Horror', 'Science Fiction', 'Thriller'];
  } else if (slug === 'tv-shows') {
    categoryTitle = 'TV Shows';
    genresToFetch = ['Animation', 'Documentary', 'Family', 'Kids', 'Mystery', 'Reality'];
  } else {
    categoryTitle = slug.replace(/-/g, ' ');
    genresToFetch = [slug];
    singleGenreMode = true;
  }

  const genreDataPromises = genresToFetch.map(async (genre) => {
    const movies = await getMoviesByGenre(genre);
    return { genre, movies };
  });

  const genreData = await Promise.all(genreDataPromises);

  const hasContent = genreData.some((data) => data.movies.length > 0);

  return {
    categoryTitle,
    genreData,
    hasContent,
    singleGenreMode,
  };
};
