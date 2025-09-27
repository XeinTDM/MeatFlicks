import { json, type RequestHandler } from '@sveltejs/kit';
import { watchlistService } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth?.();

  if (!session?.user?.id) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const watchlist = await watchlistService.getWatchlist(session.user.id);
    return json({ success: true, watchlist });
  } catch (error: any) {
    return json({ success: false, message: error?.message ?? 'Failed to load watchlist' }, { status: 500 });
  }
};
