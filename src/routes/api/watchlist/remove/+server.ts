import { json } from '@sveltejs/kit';
import { removeFromWatchlist } from '../../../../lib/watchlistActions';

export async function DELETE({ request }) {
  const { movieId } = await request.json();
  try {
    await removeFromWatchlist(movieId);
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, message: error.message }, { status: 500 });
  }
}
