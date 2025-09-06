import { getWatchlist } from '../../../src/lib/watchlistActions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user) {
    return {
      watchlistMovies: [],
      session,
      error: 'Please sign in to view your watchlist.',
    };
  }

  try {
    const watchlistMovies = await getWatchlist();
    return {
      watchlistMovies,
      session,
      error: null,
    };
  } catch (err: any) {
    console.error('Error fetching watchlist in +page.server.ts:', err);
    return {
      watchlistMovies: [],
      session,
      error: err.message || 'Failed to load watchlist.',
    };
  }
};
