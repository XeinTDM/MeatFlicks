import { authOptions } from './authUtils';
import prisma from './prisma';
import { getServerSession, type Session } from 'next-auth';

export async function addToWatchlist(movieId: string) {
  const session: Session | null = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  try {
    await prisma.watchlist.create({
      data: {
        userId,
        movieId,
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw new Error('Failed to add to watchlist');
  }
}

export async function removeFromWatchlist(movieId: string) {
  const session: Session | null = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  try {
    await prisma.watchlist.delete({
      where: {
        userId_movieId: {
          userId,
          movieId,
        },
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw new Error('Failed to remove from watchlist');
  }
}

export async function getWatchlist() {
  const session: Session | null = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  try {
    const watchlist = await prisma.watchlist.findMany({
      where: {
        userId,
      },
      include: {
        movie: true,
      },
    });
    return watchlist.map((item) => item.movie);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    throw new Error('Failed to fetch watchlist');
  }
}
