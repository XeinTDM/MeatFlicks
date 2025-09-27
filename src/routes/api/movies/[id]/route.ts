import { json, type RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/db';
import { env } from '$lib/config/env';

type TmdbCastMember = {
  id: number;
  name: string;
  character: string | null;
};

type TmdbVideo = {
  key: string;
  site: string;
  type: string;
};

type TmdbMovieResponse = {
  credits?: {
    cast?: TmdbCastMember[];
  };
  videos?: {
    results?: TmdbVideo[];
  };
};

export const GET: RequestHandler = async ({ params }) => {
  const movieId = params.id;

  if (!movieId) {
    return json({ error: 'Movie ID is required' }, { status: 400 });
  }

  try {
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      include: { genres: true }
    });

    if (!movie) {
      return json({ message: 'Movie not found' }, { status: 404 });
    }

    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=${env.TMDB_API_KEY}&append_to_response=credits,videos`
    );

    if (!tmdbResponse.ok) {
      console.error('TMDB error', await tmdbResponse.text());
      return json({ error: 'Failed to fetch movie details from TMDB' }, { status: 502 });
    }

    const tmdbData: TmdbMovieResponse = await tmdbResponse.json();

    const cast = (tmdbData.credits?.cast ?? [])
      .slice(0, 5)
      .map(({ id, name, character }) => ({
        id,
        name,
        character: character ?? ''
      }));

    const trailer = (tmdbData.videos?.results ?? []).find(
      (video) => video.type === 'Trailer' && video.site === 'YouTube'
    );

    return json({
      ...movie,
      cast,
      trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null
    });
  } catch (error) {
    console.error(`Error fetching movie with ID ${movieId}:`, error);
    return json({ error: `Failed to fetch movie with ID ${movieId}` }, { status: 500 });
  }
};
