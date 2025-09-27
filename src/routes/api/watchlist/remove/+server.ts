import { json, type RequestHandler } from '@sveltejs/kit';
import { watchlistService } from '$lib/server';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth?.();

  if (!session?.user?.id) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { movieId } = await request.json();

  try {
    await watchlistService.removeFromWatchlist(session.user.id, movieId);
    const watchlist = await watchlistService.getWatchlist(session.user.id);
    return json({ success: true, watchlist });
  } catch (error: any) {
    return json({ success: false, message: error?.message ?? 'Failed to remove from watchlist' }, { status: 500 });
  }
};
