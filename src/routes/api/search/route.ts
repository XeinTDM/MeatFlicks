import { json, type RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');

  if (!query) {
    return json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const movies = await prisma.movie.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { overview: { contains: query, mode: 'insensitive' } }
        ]
      }
    });
    return json(movies);
  } catch (error) {
    console.error('Error searching movies:', error);
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};