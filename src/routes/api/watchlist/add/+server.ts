import { json, type RequestHandler } from '@sveltejs/kit';
import { watchlistService } from '$lib/server';

export const POST: RequestHandler = async ({ request }) => {
  const { movieId } = await request.json();
  try {
    await watchlistService.addToWatchlist(movieId);
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
};
