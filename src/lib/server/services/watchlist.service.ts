import { getServerSession, type Session } from 'next-auth';
import prisma from '$lib/server/db';
import { authOptions } from '../auth/options';

async function requireSession(): Promise<Session & { user: NonNullable<Session['user']> & { id: string } }> {
  const session = (await getServerSession(authOptions as any)) as Session | null;

  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  return session as Session & { user: NonNullable<Session['user']> & { id: string } };
}

export async function addToWatchlist(movieId: string) {
  const session = await requireSession();

  try {
    await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        movieId
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw new Error('Failed to add to watchlist');
  }
}

export async function removeFromWatchlist(movieId: string) {
  const session = await requireSession();

  try {
    await prisma.watchlist.delete({
      where: {
        userId_movieId: {
          userId: session.user.id,
          movieId
        }
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw new Error('Failed to remove from watchlist');
  }
}

export async function getWatchlist() {
  const session = await requireSession();

  try {
    const watchlist = await prisma.watchlist.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        movie: true
      }
    });
    return watchlist.map((item) => item.movie);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    throw new Error('Failed to fetch watchlist');
  }
}

export const watchlistService = {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist
};