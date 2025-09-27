import type { Prisma } from '@prisma/client';
import prisma from '$lib/server/db';

function assertUser(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Unauthorized');
  }
}

export async function addToWatchlist(userId: string | null | undefined, movieId: string) {
  assertUser(userId);

  if (!movieId) {
    throw new Error('Movie id is required');
  }

  try {
    await prisma.watchlist.upsert({
      where: {
        userId_movieId: {
          userId,
          movieId
        }
      },
      update: {},
      create: {
        userId,
        movieId
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw new Error('Failed to add to watchlist');
  }
}

export async function removeFromWatchlist(userId: string | null | undefined, movieId: string) {
  assertUser(userId);

  if (!movieId) {
    throw new Error('Movie id is required');
  }

  try {
    await prisma.watchlist.delete({
      where: {
        userId_movieId: {
          userId,
          movieId
        }
      }
    });

    return { success: true };
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;

    if (prismaError?.code === 'P2025') {
      return { success: true };
    }

    console.error('Error removing from watchlist:', error);
    throw new Error('Failed to remove from watchlist');
  }
}

export async function getWatchlist(userId: string | null | undefined) {
  assertUser(userId);

  try {
    const watchlist = await prisma.watchlist.findMany({
      where: {
        userId
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
