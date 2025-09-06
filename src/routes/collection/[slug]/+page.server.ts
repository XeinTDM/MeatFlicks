import type { PageServerLoad } from './$types';
import type { Movie } from '@prisma/client';

async function getMoviesByCollection(collectionName: string): Promise<Movie[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/collections/${collectionName}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch movies for collection ${collectionName}`);
  }
  return res.json();
}

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  const collectionTitle = slug.replace(/-/g, ' ');
  const movies = await getMoviesByCollection(slug);

  const hasContent = movies.length > 0;

  return {
    collectionTitle,
    movies,
    hasContent,
  };
};
