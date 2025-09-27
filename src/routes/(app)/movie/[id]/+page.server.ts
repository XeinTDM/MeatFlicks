import type { PageServerLoad } from './$types';
import type { Prisma } from '@prisma/client';
import { resolveStreaming } from '$lib/server';

type MovieWithDetails = Prisma.MovieGetPayload<{
  include: {
    genres: true;
  };
}> & {
  cast: { id: number; name: string; character: string }[];
  trailerUrl: string | null;
};

export const load: PageServerLoad = async ({ params, fetch }) => {
  const { id } = params;

  const response = await fetch(`/api/movies/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      return { movie: null, streaming: { source: null, resolutions: [] } };
    }

    throw new Error(`Failed to fetch movie ${id}`);
  }

  const movie = (await response.json()) as MovieWithDetails | null;

  if (!movie) {
    return { movie: null, streaming: { source: null, resolutions: [] } };
  }

  try {
    const streaming = await resolveStreaming({
      mediaType: 'movie',
      tmdbId: Number(movie.tmdbId)
    });

    return {
      movie,
      streaming
    };
  } catch (error) {
    console.error('[movie][load] Failed to resolve streaming sources', error);
    return {
      movie,
      streaming: { source: null, resolutions: [] }
    };
  }
};
