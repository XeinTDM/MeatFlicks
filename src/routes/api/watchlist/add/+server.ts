import { json } from '@sveltejs/kit';
import { addToWatchlist } from '../../../../lib/watchlistActions';

export async function POST({ request }) {
  const { movieId } = await request.json();
  try {
    await addToWatchlist(movieId);
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
}
