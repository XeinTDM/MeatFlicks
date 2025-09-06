import { json } from '@sveltejs/kit';
import { getWatchlist } from '../../../../lib/watchlistActions';

export async function GET() {
  try {
    const watchlist = await getWatchlist();
    return json(watchlist);
  } catch (error: any) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
}
