import { json, type RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/db';
import { fetchTmdbMovieExtras, lookupTmdbIdByImdbId } from '$lib/server/services/tmdb.service';

async function resolveMovieByIdentifier(
  identifier: string,
  queryMode: 'id' | 'tmdb' | 'imdb'
) {
  switch (queryMode) {
    case 'tmdb': {
      const tmdbId = Number.parseInt(identifier, 10);
      if (!Number.isFinite(tmdbId)) {
        throw new Error('Invalid TMDB id provided.');
      }

      const movie = await prisma.movie.findUnique({
        where: { tmdbId },
        include: { genres: true }
      });

      return { movie, tmdbId } as const;
    }
    case 'imdb': {
      const tmdbId = await lookupTmdbIdByImdbId(identifier);
      if (!tmdbId) {
        return { movie: null, tmdbId: null } as const;
      }

      const movie = await prisma.movie.findUnique({
        where: { tmdbId },
        include: { genres: true }
      });

      return { movie, tmdbId } as const;
    }
    case 'id':
    default: {
      const movie = await prisma.movie.findUnique({
        where: { id: identifier },
        include: { genres: true }
      });

      return { movie, tmdbId: movie?.tmdbId ?? null } as const;
    }
  }
}

export const GET: RequestHandler = async ({ params, url }) => {
  const movieIdentifier = params.id;
  const queryModeParam = url.searchParams.get('by');
  const queryMode = queryModeParam === 'tmdb' || queryModeParam === 'imdb' ? queryModeParam : 'id';

  if (!movieIdentifier) {
    return json({ error: 'Movie identifier is required.' }, { status: 400 });
  }

  try {
    const { movie, tmdbId } = await resolveMovieByIdentifier(movieIdentifier, queryMode);

    if (!movie || !tmdbId) {
      return json({ message: 'Movie not found' }, { status: 404 });
    }

    const extras = await fetchTmdbMovieExtras(tmdbId);

    const payload = {
      ...movie,
      releaseDate: movie.releaseDate ?? (extras.releaseDate ? new Date(extras.releaseDate) : null),
      durationMinutes: movie.durationMinutes ?? extras.runtime ?? null,
      imdbId: extras.imdbId,
      cast: extras.cast,
      trailerUrl: extras.trailerUrl
    };

    return json(payload);
  } catch (error) {
    console.error(`Error fetching movie with identifier ${movieIdentifier}:`, error);
    return json({ error: `Failed to fetch movie with identifier ${movieIdentifier}` }, { status: 500 });
  }
};
