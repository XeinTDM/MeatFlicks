import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/lib/env';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id: movieId } = params;

  try {
    const movie = await prisma.movie.findUnique({
      where: {
        id: movieId,
      },
      include: {
        genres: true,
      },
    });

    if (!movie) {
      return NextResponse.json({ message: 'Movie not found' }, { status: 404 });
    }

    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=${env.TMDB_API_KEY}&append_to_response=credits,videos`,
    );
    const tmdbData = await tmdbResponse.json();

    const cast = tmdbData.credits.cast.slice(0, 5).map((actor: any) => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
    }));

    const trailer = tmdbData.videos.results.find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube',
    );
    const trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;

    const movieWithDetails = {
      ...movie,
      cast,
      trailerUrl,
    };

    return NextResponse.json(movieWithDetails);
  } catch (error) {
    console.error(`Error fetching movie with ID ${movieId}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch movie with ID ${movieId}` },
      { status: 500 },
    );
  }
}
