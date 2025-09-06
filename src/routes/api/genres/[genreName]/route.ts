import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';



interface RouteContext {
  params: { genreName: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { genreName } = context.params;

  try {
    const movies = await prisma.movie.findMany({
      where: {
        genres: {
          some: {
            name: genreName,
          },
        },
      },
      include: {
        genres: true,
      },
      orderBy: {
        rating: 'desc',
      },
    });

    if (!movies || movies.length === 0) {
      return NextResponse.json(
        { message: `No movies found for genre: ${genreName}` },
        { status: 404 },
      );
    }

    return NextResponse.json(movies);
  } catch (error) {
    console.error(`Error fetching movies for genre ${genreName}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch movies for genre ${genreName}` },
      { status: 500 },
    );
  }
}