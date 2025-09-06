import type { PageServerLoad } from './$types';
import type { Movie, Prisma } from '@prisma/client';

type MovieWithDetails = Prisma.MovieGetPayload<{
  include: {
    genres: true;
  };
}> & {
  cast: { id: number; name: string; character: string }[];
  trailerUrl: string | null;
};

async function getMovie(id: string): Promise<MovieWithDetails | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/movies/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch movie');
  }
  return res.json();
}

export const load: PageServerLoad = async ({ params }) => {
  const { id } = params;
  const movie: MovieWithDetails | null = await getMovie(id);

  return {
    movie,
  };
};
