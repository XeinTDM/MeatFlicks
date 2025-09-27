import { json, type RequestHandler } from '@sveltejs/kit';
import { watchlistService } from '$lib/server';

export const GET: RequestHandler = async () => {
  try {
    const watchlist = await watchlistService.getWatchlist();
    return json({ success: true, watchlist });
  } catch (error: any) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
};
